import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/chat/chat_messages_controller.dart';
import '../../providers/chat/chat_providers.dart';

class ChatThreadPage extends ConsumerStatefulWidget {
  const ChatThreadPage({super.key, required this.threadId});
  final String threadId;

  @override
  ConsumerState<ChatThreadPage> createState() => _ChatThreadPageState();
}

class _ChatThreadPageState extends ConsumerState<ChatThreadPage> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Please login to view this chat.')),
      );
    }

    // ✅ only UI: read thread -> get other user id -> read profile name
    final threadStream = FirebaseFirestore.instance
        .collection('chat_threads')
        .doc(widget.threadId)
        .snapshots();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: threadStream,
      builder: (context, threadSnap) {
        final threadData = threadSnap.data?.data();
        final participants =
            List<String>.from(threadData?['participantIds'] ?? const []);

        final otherUserId = participants.firstWhere(
          (id) => id != user.uid,
          orElse: () => '',
        );

        if (otherUserId.isEmpty) {
          return _buildScaffold(title: 'Chat', userId: user.uid);
        }

        final profileStream = FirebaseFirestore.instance
            .collection('profiles')
            .doc(otherUserId)
            .snapshots();

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: profileStream,
          builder: (context, profileSnap) {
            final profileData = profileSnap.data?.data();
            final name = (profileData?['displayName'] ?? '').toString().trim();

            final title = name.isNotEmpty ? name : 'Chat';
            return _buildScaffold(title: title, userId: user.uid);
          },
        );
      },
    );
  }

  Widget _buildScaffold({required String title, required String userId}) {
    final messagesAsync =
        ref.watch(chatMessagesControllerProvider(widget.threadId));

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text(e.toString())),
              data: (messages) {
                if (messages.isEmpty) {
                  return const Center(child: Text('No messages yet'));
                }

                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.all(12),
                  itemCount: messages.length,
                  itemBuilder: (_, i) {
                    final m = messages[i];
                    final isMe = m.senderId == userId;

                    return Align(
                      alignment:
                          isMe ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isMe
                              ? Colors.blue.withOpacity(0.2)
                              : Colors.grey.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(m.text),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(hintText: 'Type message'),
                    onSubmitted: (_) async {
                      final text = _controller.text.trim();
                      if (text.isEmpty) return;
                      _controller.clear();

                      await ref.read(sendMessageProvider).call(
                            threadId: widget.threadId,
                            senderId: userId,
                            text: text,
                          );
                    },
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: () async {
                    final text = _controller.text.trim();
                    if (text.isEmpty) return;
                    _controller.clear();

                    await ref.read(sendMessageProvider).call(
                          threadId: widget.threadId,
                          senderId: userId,
                          text: text,
                        );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
