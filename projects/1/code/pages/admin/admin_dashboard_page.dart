import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AdminDashboardPage extends StatelessWidget {
  const AdminDashboardPage({super.key});

  Future<void> _logout(BuildContext context) async {
    await FirebaseAuth.instance.signOut();
    // AuthGate will automatically redirect to LoginPage
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
            onPressed: () => _logout(context),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: ListTile(
                leading: const Icon(Icons.pets),
                title: const Text('Manage Pets'),
                subtitle: const Text('Add / Edit / Delete pets'),
                onTap: () {
                  // TODO: Navigate to AdminManagePetsPage
                },
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.people),
                title: const Text('Manage Users'),
                subtitle: const Text('Promote to shelter / admin (later)'),
                onTap: () {
                  // TODO: Navigate to AdminManageUsersPage (future)
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
