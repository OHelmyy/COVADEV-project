import 'dart:async';
import '../../../core/constants/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../presentations/providers/auth/auth_providers.dart';
import '../../../presentations/providers/notifications/notification_providers.dart';
import '../../../presentations/providers/notifications/notification_controller.dart';

final notificationControllerProvider = Provider<NotificationController>((ref) {
  return NotificationController(
    getStream: ref.watch(getNotificationStreamUseCaseProvider),
    markRead: ref.watch(markNotificationReadUseCaseProvider),
  );
});

final notificationsStreamProvider = StreamProvider.autoDispose((ref) {
  final uid = ref.watch(currentUserIdProvider);
  if (uid == null) return const Stream.empty();

  final controller = ref.watch(notificationControllerProvider);
  return controller.streamForUser(uid);
});

/// Unread count
final unreadNotificationsCountProvider = Provider.autoDispose<int>((ref) {
  final asyncNotifs = ref.watch(notificationsStreamProvider);

  return asyncNotifs.maybeWhen(
    data: (items) =>
        items.where((n) => n.isRead == false).length,
    orElse: () => 0,
  );
});


String _formatNotifDate(DateTime? dt) {
  if (dt == null) return '';
  final now = DateTime.now();
  final diff = now.difference(dt);

  if (diff.inSeconds < 60) return '${diff.inSeconds}s';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays == 1) return 'Yesterday';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return '${dt.day}/${dt.month}/${dt.year}';
}

class NotificationsCenterPage extends ConsumerWidget {
  const NotificationsCenterPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(currentUserIdProvider);
    final asyncNotifs = ref.watch(notificationsStreamProvider);
    


    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          //  Safe back: if no stack, go home
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go(AppRoutes.home);
            }
          },
        ),
      ),
      body: uid == null
          ? const Center(child: Text('Please login to view notifications.'))
          : asyncNotifs.when(
              data: (items) {
                if (items.isEmpty) {
                  return const Center(child: Text('No notifications yet.'));
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final n = items[i];

                    return ListTile(
                      tileColor: n.isRead
                          ? null
                          : Theme.of(context)
                              .colorScheme
                              .primary
                              .withOpacity(0.08),
                      title: Row(
                        children: [
                          Expanded(
                            child: Text(
                              n.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _formatNotifDate(n.createdAt), // DATE HERE
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      subtitle: Text(n.body),
                      trailing: n.isRead ? null : const Icon(Icons.fiber_new),
                      onTap: () async {
                                  await ref.read(notificationControllerProvider).markAsRead(uid, n.id);

                                  if (!context.mounted) return;

                                  // 1) try deepLink if it exists
                                  final deepLink = n.deepLink;
                                  if (deepLink != null && deepLink.isNotEmpty) {
                                    context.push(deepLink);
                                    return;
                                  }

                                  // 2) fallback: open chat thread by threadId from data
                                  final threadId = n.data?['threadId'] as String?;
                                  if (threadId != null && threadId.isNotEmpty) {
                                    context.push('/chat/thread/$threadId');
                                  }
                                },

                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
    );
  }
}
