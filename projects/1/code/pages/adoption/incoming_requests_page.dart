import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_application_1/core/widgets/adoption_request_card.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/adoption/adoption_streams.dart';
import '../../providers/adoption/adoption_controller.dart';
import '../../providers/auth/auth_state_provider.dart';
import '../../../domain/entities/adoption/adoption_request.dart';

class IncomingRequestsPage extends ConsumerStatefulWidget {
  final String? petId;
  final String? petName;

  const IncomingRequestsPage({
    super.key,
    this.petId,
    this.petName,
  });

  @override
  ConsumerState<IncomingRequestsPage> createState() =>
      _IncomingRequestsPageState();
}

class _IncomingRequestsPageState extends ConsumerState<IncomingRequestsPage>
    with SingleTickerProviderStateMixin {
  String? _selectedPetId;
  String? _selectedPetName;

  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _selectedPetId = widget.petId;
    _selectedPetName =
        (widget.petName?.trim().isNotEmpty == true) ? widget.petName!.trim() : null;

    _tab = TabController(length: 2, vsync: this);

    if (_selectedPetId != null) {
      _tab.index = 1;
    }
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<bool> _confirmAccept(BuildContext context, String petName) async {
    final res = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Accept request?'),
        content: Text(
          'Accepting will mark this pet as adopted and reject other pending requests.\n\n'
          'Pet: "$petName"',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Accept'),
          ),
        ],
      ),
    );
    return res ?? false;
  }

  Future<bool> _confirmReject(BuildContext context, String petName) async {
    final res = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Reject request?'),
        content: Text('Reject request for "$petName"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    return res ?? false;
  }

  void _clearFilter() {
    setState(() {
      _selectedPetId = null;
      _selectedPetName = null;
    });
  }

  // ---------- Helpers for By Pet (name + photo fallback from pets/{petId}) ----------

  String? _pickPetNameFromPetsDoc(Map<String, dynamic>? data) {
    if (data == null) return null;
    final v = (data['name'] ?? data['petName'] ?? data['title'] ?? '').toString().trim();
    return v.isEmpty ? null : v;
  }

  String? _pickPetPhotoFromPetsDoc(Map<String, dynamic>? data) {
    if (data == null) return null;
    final v = (data['photoUrl'] ??
            data['petPhotoUrl'] ??
            data['imageUrl'] ??
            data['photo'] ??
            data['image'] ??
            '')
        .toString()
        .trim();
    return v.isEmpty ? null : v;
  }

  Widget _petGroupTitle(_PetGroup g) {
    final n = g.petName?.trim();
    if (n != null && n.isNotEmpty && n.toLowerCase() != 'pet') {
      return Text(
        n,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
      );
    }

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('pets').doc(g.petId).snapshots(),
      builder: (context, snap) {
        final name = _pickPetNameFromPetsDoc(snap.data?.data());
        return Text(
          name ?? 'Pet',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
        );
      },
    );
  }

  Widget _petGroupThumb(_PetGroup g) {
    final u = g.photoUrl?.trim();
    if (u != null && u.isNotEmpty) {
      return _SmallPetThumb(url: u);
    }

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('pets').doc(g.petId).snapshots(),
      builder: (context, snap) {
        final url = _pickPetPhotoFromPetsDoc(snap.data?.data());
        return _SmallPetThumb(url: url);
      },
    );
  }

  Future<void> _selectPetAndGoToAll(_PetGroup g) async {
    setState(() {
      _selectedPetId = g.petId;
      _selectedPetName = (g.petName?.trim().isNotEmpty == true) ? g.petName!.trim() : null;
    });

    _tab.animateTo(1);

    // لو الاسم مش موجود في الجروب، هاته مرة واحدة من pets عشان العنوان يبقى صح
    if (_selectedPetName == null || _selectedPetName!.isEmpty) {
      final doc =
          await FirebaseFirestore.instance.collection('pets').doc(g.petId).get();
      final name = _pickPetNameFromPetsDoc(doc.data());
      if (!mounted) return;
      if (name != null && name.isNotEmpty) {
        setState(() => _selectedPetName = name);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authUserProvider);

    return authAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        body: Center(child: Text('Auth error: $e')),
      ),
      data: (user) {
        if (user == null) {
          return const Scaffold(body: Center(child: Text('Please login')));
        }

        final async =
            ref.watch(incomingAdoptionRequestsStreamProvider(user.uid));
        final ctrlState = ref.watch(adoptionControllerProvider);
        final controller = ref.read(adoptionControllerProvider.notifier);

final title = 'Incoming Requests';

        // final title = _selectedPetId == null
        //     ? 'Incoming Requests'
        //     : 'Requests • ${_selectedPetName ?? 'Pet'}';

        return Scaffold(
          appBar: AppBar(
            title: Text(title),
            actions: [
              if (_selectedPetId != null)
                IconButton(
                  tooltip: 'Clear filter',
                  onPressed: () {
                    _clearFilter();
                    _tab.animateTo(0);
                  },
                  icon: const Icon(Icons.filter_alt_off),
                ),
            ],
            bottom: TabBar(
              controller: _tab,
              tabs: const [
                Tab(text: 'By Pet'),
                Tab(text: 'All Requests'),
              ],
            ),
          ),
          body: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (items) {
              // =============== Group by pet ===============
              final Map<String, _PetGroup> groups = {};

              for (final r in items) {
                final g = groups.putIfAbsent(
                  r.petId,
                  () => _PetGroup(petId: r.petId),
                );

                // cache name/photo if present in request
                final reqName = r.petName?.trim();
                if (g.petName == null && reqName != null && reqName.isNotEmpty) {
                  g.petName = reqName;
                }

                final reqPhoto = r.petPhotoUrl?.trim();
                if (g.photoUrl == null && reqPhoto != null && reqPhoto.isNotEmpty) {
                  g.photoUrl = reqPhoto;
                }

                g.total++;
                if (r.status == AdoptionStatus.pending) g.pending++;
              }

              final petGroups = groups.values.toList()
                ..sort((a, b) => b.pending.compareTo(a.pending));

              // =============== Apply filter ===============
              final filtered = (_selectedPetId == null)
                  ? items
                  : items.where((r) => r.petId == _selectedPetId).toList();

              // =============== UI ===============
              return TabBarView(
                controller: _tab,
                children: [
                  // -------- Tab 1: By Pet --------
                  ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      const SizedBox(height: 6),
                      const Text(
                        'Requests per Pet',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (petGroups.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 22),
                          child:
                              Center(child: Text('No incoming requests yet.')),
                        )
                      else
                        ...petGroups.map((g) {
                          return Card(
                            elevation: 0.6,
                            margin: const EdgeInsets.symmetric(vertical: 6),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  _petGroupThumb(g),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        _petGroupTitle(g),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Requests: ${g.total}  •  Pending: ${g.pending}',
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  OutlinedButton(
                                    onPressed: () => _selectPetAndGoToAll(g),
                                    child: const Text('View Requests'),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),

                  // -------- Tab 2: All Requests --------
                  ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      if (_selectedPetId != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            color: Colors.grey.shade100,
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.filter_alt),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Filtered by: ${_selectedPetName ?? 'Pet'}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              TextButton(
                                onPressed: _clearFilter,
                                child: const Text('Clear'),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (filtered.isEmpty)
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 30),
                            child: Text(
                              _selectedPetId == null
                                  ? 'No incoming requests'
                                  : 'No requests for this pet',
                            ),
                          ),
                        )
                      else
                        ...filtered.map((r) {
                          final canDecide = r.status == AdoptionStatus.pending;

                          // Note: AdoptionRequestCard already fetches name fallback (you fixed it)
                          final petTitle =
                              (r.petName?.trim().isNotEmpty == true)
                                  ? r.petName!.trim()
                                  : 'Pet';

                          return AdoptionRequestCard(
                            r: r,
                            onAccept: (!canDecide || ctrlState.isLoading)
                                ? null
                                : () async {
                                    final okConfirm =
                                        await _confirmAccept(context, petTitle);
                                    if (!okConfirm) return;

                                    final ok = await controller.updateStatus(
                                      requestId: r.id,
                                      status: AdoptionStatus.accepted,
                                      threadId: r.threadId,
                                    );

                                    if (!context.mounted) return;

                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          ok
                                              ? 'Request accepted ✅'
                                              : (ref
                                                      .read(adoptionControllerProvider)
                                                      .error ??
                                                  'Failed to accept'),
                                        ),
                                      ),
                                    );
                                  },
                            onReject: (!canDecide || ctrlState.isLoading)
                                ? null
                                : () async {
                                    final okConfirm =
                                        await _confirmReject(context, petTitle);
                                    if (!okConfirm) return;

                                    final ok = await controller.updateStatus(
                                      requestId: r.id,
                                      status: AdoptionStatus.rejected,
                                      threadId: r.threadId,
                                    );

                                    if (!context.mounted) return;

                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          ok
                                              ? 'Request rejected ✅'
                                              : (ref
                                                      .read(adoptionControllerProvider)
                                                      .error ??
                                                  'Failed to reject'),
                                        ),
                                      ),
                                    );
                                  },
                          );
                        }).toList(),
                    ],
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class _PetGroup {
  final String petId;
  String? petName;
  String? photoUrl;
  int total = 0;
  int pending = 0;

  _PetGroup({
    required this.petId,
    this.petName,
    this.photoUrl,
  });
}

/// Small thumb used in By Pet list
class _SmallPetThumb extends StatelessWidget {
  final String? url;
  const _SmallPetThumb({this.url});

  @override
  Widget build(BuildContext context) {
    final hasUrl = url?.trim().isNotEmpty == true;

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 44,
        height: 44,
        color: Colors.grey.shade200,
        child: hasUrl
            ? Image.network(url!, fit: BoxFit.cover)
            : const Icon(Icons.pets, size: 22),
      ),
    );
  }
}
