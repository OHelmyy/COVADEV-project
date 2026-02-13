import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/auth/auth_state_provider.dart';
import 'my_requests_page.dart';
import 'incoming_requests_page.dart';
import 'my_accepted_history_page.dart'; // ✅ NEW

class AdoptionHubPage extends ConsumerWidget {
  const AdoptionHubPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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

        return DefaultTabController(
          length: 3, // ✅ was 2
          child: Scaffold(
            appBar: AppBar(
              title: const Text('Adoption'),

              // ✅ optional shortcut button (opens history directly)
              actions: [
                IconButton(
                  tooltip: 'Accepted History',
                  icon: const Icon(Icons.history),
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const MyAcceptedHistoryPage(),
                      ),
                    );
                  },
                ),
              ],

              bottom: const TabBar(
                tabs: [
                  Tab(text: 'My Requests'),
                  Tab(text: 'Incoming'),
                  Tab(text: 'Accepted'), // ✅ NEW
                ],
              ),
            ),
            body: const TabBarView(
              children: [
                MyRequestsPage(),
                IncomingRequestsPage(),
                MyAcceptedHistoryPage(), // ✅ NEW
              ],
            ),
          ),
        );
      },
    );
  }
}
