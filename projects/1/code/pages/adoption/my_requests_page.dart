import 'package:flutter/material.dart';
import 'package:flutter_application_1/core/widgets/adoption_request_card.dart';
import 'package:flutter_application_1/presentations/providers/adoption/adoption_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/adoption/adoption_streams.dart';
import '../../providers/auth/auth_state_provider.dart';
import '../../../domain/entities/adoption/adoption_request.dart';

class MyRequestsPage extends ConsumerWidget {
  const MyRequestsPage({super.key});

  Future<bool> _confirmCancel(BuildContext context, String petName) async {
    final res = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel request?'),
        content: Text('Are you sure you want to cancel your request for "$petName"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Yes, cancel'),
          ),
        ],
      ),
    );
    return res ?? false;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authUserProvider);
    final controllerState = ref.watch(adoptionControllerProvider);
    final controller = ref.read(adoptionControllerProvider.notifier);

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

        final async = ref.watch(myAdoptionRequestsStreamProvider(user.uid));

        return Scaffold(
          appBar: AppBar(title: const Text('My Requests')),
          body: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (items) {
              if (items.isEmpty) {
                return const Center(child: Text('No pending requests'));
              }

              return ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final r = items[i];
                  final petTitle = r.petName ?? 'Pet: ${r.petId}';

                  return AdoptionRequestCard(
                    r: r,
                    onCancel: r.status == AdoptionStatus.pending
                        ? () async {
                            if (controllerState.isLoading) return;

                            final ok = await _confirmCancel(context, petTitle);
                            if (!ok) return;

                            final success = await controller.updateStatus(
                              requestId: r.id,
                              status: AdoptionStatus.cancelled,
                              threadId: r.threadId,
                            );

                            if (!context.mounted) return;

                            if (success) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Request cancelled ✅')),
                              );
                              // will disappear automatically because stream is pending-only
                            } else {
                              final msg =
                                  ref.read(adoptionControllerProvider).error ??
                                  'Failed to cancel request';
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(msg)),
                              );
                            }
                          }
                        : null,
                  );
                },
              );
            },
          ),
        );
      },
    );
  }
}
