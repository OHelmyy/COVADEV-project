import 'package:flutter/material.dart';

class AdminManagePetsPage extends StatelessWidget {
  const AdminManagePetsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Pets')),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // later: open add pet form
        },
        child: const Icon(Icons.add),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Pets List (placeholder)'),
          const SizedBox(height: 12),

          // Example row (placeholder)
          Card(
            child: ListTile(
              title: const Text('Pet Name هنا'),
              subtitle: const Text('Type / Age / Location'),
              trailing: Wrap(
                spacing: 8,
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: () {
                      // later: edit pet
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete),
                    onPressed: () {
                      // later: delete pet
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
