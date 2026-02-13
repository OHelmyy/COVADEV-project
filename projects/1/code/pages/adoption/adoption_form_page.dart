import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/adoption/adoption_controller.dart';
import '../../providers/auth/auth_state_provider.dart';

class AdoptionFormPage extends ConsumerStatefulWidget {
  const AdoptionFormPage({
    super.key,
    required this.petId,
    required this.ownerId,
    required this.petName,
    required this.petType,
    this.petLocation,
    this.petPhotoUrl,
  });

  final String petId;
  final String ownerId;
  final String petName;
  final String petType;
  final String? petLocation;
  final String? petPhotoUrl;

  @override
  ConsumerState<AdoptionFormPage> createState() => _AdoptionFormPageState();
}

class _AdoptionFormPageState extends ConsumerState<AdoptionFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _msgController = TextEditingController();

  @override
  void dispose() {
    _msgController.dispose();
    super.dispose();
  }

  String? _buildRequesterName(dynamic me) {
    // me is your Firebase user object (from authUserProvider)
    final displayName = (me.displayName as String?)?.trim();
    if (displayName != null && displayName.isNotEmpty) return displayName;

    final email = (me.email as String?)?.trim();
    if (email != null && email.contains('@')) {
      final prefix = email.split('@').first.trim();
      if (prefix.isNotEmpty) return prefix;
    }

    // last fallback: null (UI can show Unknown)
    return null;
  }

  Future<void> _submit() async {
    final authState = ref.read(authUserProvider);

    // If still loading user
    if (authState.isLoading) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Loading user...')),
      );
      return;
    }

    final me = authState.value;

    // Not logged in
    if (me == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please login first.')),
      );
      return;
    }

    // Can't adopt your own pet
    if (me.uid == widget.ownerId) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You cannot request adoption for your own pet.'),
        ),
      );
      return;
    }

    // Validate form
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final controller = ref.read(adoptionControllerProvider.notifier);

    final message = _msgController.text.trim();
    final requesterName = _buildRequesterName(me);

    final id = await controller.createRequest(
      petId: widget.petId,
      ownerId: widget.ownerId,
      requesterId: me.uid,

      // ✅ THIS is what makes Incoming show the real name
      requesterName: requesterName,

      message: message.isEmpty ? null : message,
      petName: widget.petName,
      petType: widget.petType,
      petLocation: widget.petLocation,
      petPhotoUrl: widget.petPhotoUrl,
    );

    if (!mounted) return;

    if (id != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Adoption request sent ✅')),
      );
      Navigator.of(context).pop(true);
    } else {
      final state = ref.read(adoptionControllerProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(state.error ?? 'Failed to send request')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(adoptionControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Adoption Request')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Pet: ${widget.petName} (${widget.petType})',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _msgController,
                decoration: const InputDecoration(
                  labelText: 'Message (optional)',
                  hintText: 'Tell the owner why you want to adopt...',
                  border: OutlineInputBorder(),
                ),
                maxLines: 4,
                maxLength: 500,
                validator: (v) {
                  if (v != null && v.length > 500) return 'Max 500 characters';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: state.isLoading ? null : _submit,
                  child: state.isLoading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Submit'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
