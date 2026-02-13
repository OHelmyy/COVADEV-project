import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_indicator.dart';

import '../../providers/pets/pet_providers.dart';
import '../../providers/auth/auth_state_provider.dart';

import 'pet_form_page.dart';
import '../adoption/adoption_form_page.dart';

class PetDetailPage extends ConsumerWidget {
  const PetDetailPage({super.key, required this.petId});

  final String petId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final petAsync = ref.watch(petDetailControllerProvider(petId));
    final currentUid = FirebaseAuth.instance.currentUser?.uid;

    Future<void> confirmAndDelete({
      required String petId,
      required String petName,
    }) async {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Delete pet'),
          content: Text('Are you sure you want to delete "$petName"?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );

      if (confirm != true) return;

      try {
        final deletePet = ref.read(deletePetUseCaseProvider);
        await deletePet(petId);

        if (!context.mounted) return;
        Navigator.of(context).pop(); // go back to list
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete pet: $e')),
        );
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pet Details'),
        actions: [
          petAsync.maybeWhen(
            data: (pet) {
              final isOwner = (currentUid != null && pet.ownerId == currentUid);

              // ✅ Only owner can see Edit + Delete
              if (!isOwner) return const SizedBox.shrink();

              return Row(
                children: [
                  IconButton(
                    tooltip: 'Edit pet',
                    icon: const Icon(Icons.edit),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => PetFormPage(existing: pet),
                        ),
                      );
                    },
                  ),
                  IconButton(
                    tooltip: 'Delete pet',
                    icon: const Icon(Icons.delete),
                    onPressed: () => confirmAndDelete(
                      petId: pet.id,
                      petName: pet.name,
                    ),
                  ),
                ],
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),

      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: petAsync.maybeWhen(
        data: (pet) {
          // ✅ hide if already adopted
          // ✅ Hide Adopt if already adopted
          if (pet.isAdopted == true) return const SizedBox.shrink();

          // ✅ Hide Adopt if current user is owner
          final isOwner = (currentUid != null && pet.ownerId == currentUid);
          if (isOwner) return const SizedBox.shrink();

          return SizedBox(
            width: MediaQuery.of(context).size.width * 0.75,
            height: 52,
            child: FloatingActionButton.extended(
              onPressed: () async {
                final ok = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => AdoptionFormPage(
                      petId: pet.id, 
                      ownerId: pet.ownerId, petName: '', petType: '', 
                    ),
                  ),
                );

                // ✅ optional snack if returned success
                if (context.mounted && ok == true) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Request sent ✅')),
                  );
                }
              },
              icon: const Icon(Icons.volunteer_activism),
              label: const Text('Adopt'),
            ),
          );
        },
        orElse: () => const SizedBox.shrink(),
      ),

      body: petAsync.when(
        loading: () => const Center(child: LoadingIndicator()),
        error: (e, _) => ErrorView(message: e.toString()),
        data: (pet) {
          final firstPhoto = pet.photoUrls.isNotEmpty ? pet.photoUrls.first : null;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: firstPhoto != null
                    ? Image.network(firstPhoto, fit: BoxFit.cover)
                    : const Center(child: Icon(Icons.pets, size: 48)),
              ),
              const SizedBox(height: 12),
              Text(pet.name, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 6),
              Text('${pet.type}${pet.breed != null ? " • ${pet.breed}" : ""}'),
              if (pet.location != null) ...[
                const SizedBox(height: 6),
                Text('Location: ${pet.location}'),
              ],
              const SizedBox(height: 12),
              Text(pet.description ?? 'No description'),
              const SizedBox(height: 80),
            ],
          );
        },
      ),
    );
  }
}
