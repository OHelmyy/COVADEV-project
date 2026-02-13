import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/chat/profile_search_providers.dart';
import '../../providers/chat/chat_providers.dart';
import 'chat_thread_page.dart';

class NewChatPage extends ConsumerStatefulWidget {
  const NewChatPage({super.key, required this.myUid});
  final String myUid;

  @override
  ConsumerState<NewChatPage> createState() => _NewChatPageState();
}

class _NewChatPageState extends ConsumerState<NewChatPage> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final q = _searchCtrl.text;
    final resultsAsync = ref.watch(profilesSearchProvider(q));

    return Scaffold(
      appBar: AppBar(title: const Text('New chat')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _searchCtrl,
              decoration: const InputDecoration(
                labelText: 'Search users by name',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: q.trim().isEmpty
                  ? const Center(child: Text('Type a name to search…'))
                  : resultsAsync.when(
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (e, _) => Center(child: Text('Search error:\n$e')),
                      data: (profiles) {
                        final filtered = profiles
                            .where((p) => p['userId'] != widget.myUid)
                            .toList();

                        if (filtered.isEmpty) {
                          return const Center(child: Text('No users found.'));
                        }

                        return ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final p = filtered[i];
                            final name =
                                (p['displayName'] as String?) ?? 'No name';
                            final email = (p['email'] as String?) ?? '';
                            final otherUid = p['userId'] as String;

                            return ListTile(
                              leading:
                                  const CircleAvatar(child: Icon(Icons.person)),
                              title: Text(name),
                              subtitle: Text(email),
                              onTap: () async {
                                final threadId = await ref
                                    .read(createThreadIfNeededProvider)
                                    .call([widget.myUid, otherUid], petId: null);

                                if (!context.mounted) return;

                                Navigator.of(context).pushReplacement(
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        ChatThreadPage(threadId: threadId),
                                  ),
                                );
                              },
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
