
import 'package:flutter/material.dart';
import 'package:flutter_application_1/core/widgets/adoption_request_card.dart';
import 'package:flutter_application_1/presentations/pages/chat/chat_thread_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/auth/auth_state_provider.dart';
import '../../providers/adoption/adoption_streams.dart';
import '../widgets/adoption_request_card.dart';

// ✅ ADD: import the chat thread page
class MyAcceptedHistoryPage extends ConsumerWidget {
  const MyAcceptedHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authUserProvider);

    // ✅ FIX: open chat page instead of SnackBar
    void _openChat(String threadId) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatThreadPage(threadId: threadId),
        ),
      );
    }

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
            ref.watch(myAcceptedAdoptionRequestsStreamProvider(user.uid));

        return Scaffold(
          appBar: AppBar(title: const Text('Accepted History')),
          body: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (items) {
              if (items.isEmpty) {
                return const Center(child: Text('No accepted requests yet'));
              }

              return ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final r = items[i];

                  // ✅ detect threadId
                  final tid = r.threadId?.trim();
                  final canOpenChat = tid != null && tid.isNotEmpty;

                  return AdoptionRequestCard(
                    r: r,
                    showRequester: false,
                    onOpenChat: canOpenChat ? () => _openChat(tid) : null,
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