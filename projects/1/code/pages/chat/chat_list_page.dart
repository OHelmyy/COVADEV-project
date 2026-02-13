import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../providers/chat/chat_threads_controller.dart';
import '../../providers/profile/profile_providers.dart';
import 'chat_thread_page.dart';
import 'new_chat_page.dart';

class ChatListPage extends ConsumerWidget {
  const ChatListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = FirebaseAuth.instance.currentUser;

    if (user == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('You need to login to use chat.'),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => context.go(AppRoutes.login),
              icon: const Icon(Icons.login),
              label: const Text('Login'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => context.go(AppRoutes.register),
              child: const Text('Create account'),
            ),
          ],
        ),
      );
    }

    final threadsAsync = ref.watch(chatThreadsControllerProvider(user.uid));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
        actions: [
          IconButton(
            tooltip: 'New chat',
            icon: const Icon(Icons.chat_bubble_outline),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => NewChatPage(myUid: user.uid)),
              );
            },
          ),
        ],
      ),
      body: threadsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Chat error:\n$e')),
        data: (threads) {
          if (threads.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('No chats yet. Start a new conversation.'),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => NewChatPage(myUid: user.uid),
                          ),
                        );
                      },
                      icon: const Icon(Icons.chat),
                      label: const Text('New chat'),
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            itemCount: threads.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final t = threads[i];
              final otherUserId =
                  t.participantIds.firstWhere((id) => id != user.uid);

              final otherProfileAsync =
                  ref.watch(profileStreamProvider(otherUserId));

              return otherProfileAsync.when(
                loading: () => ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: const Text('Loading...'),
                  subtitle: Text(t.lastMessage ?? 'No messages yet'),
                  onTap: () => _openThread(context, t.id),
                ),
                error: (e, _) => ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: const Text('Unknown user'),
                  subtitle: Text(t.lastMessage ?? 'No messages yet'),
                  onTap: () => _openThread(context, t.id),
                ),
                data: (profile) {
                  final name = profile.displayName ?? profile.fullName;

                  return ListTile(
                    leading: CircleAvatar(
                      backgroundImage:
                          (profile.photoUrl != null && profile.photoUrl!.isNotEmpty)
                              ? NetworkImage(profile.photoUrl!)
                              : null,
                      child: (profile.photoUrl == null || profile.photoUrl!.isEmpty)
                          ? const Icon(Icons.person)
                          : null,
                    ),
                    title: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      t.lastMessage ?? 'No messages yet',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => _openThread(context, t.id),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  void _openThread(BuildContext context, String threadId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatThreadPage(threadId: threadId),
      ),
    );
  }
}
