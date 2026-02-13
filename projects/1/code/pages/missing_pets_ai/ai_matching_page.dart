import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/pets/pet_providers.dart';
import '../../providers/missing_pets_ai/ai_matching_providers.dart';
import '../../providers/missing_pets_ai/ai_matching_state.dart';
import '../../../domain/entities/pets/pet.dart';

class AiMatchingPage extends ConsumerWidget {
  const AiMatchingPage({super.key});

  static const _types = <String>['cat', 'dog', 'bird', 'other'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final petsAsync = ref.watch(
      petsStreamProvider(
        const PetsStreamFilter(
          type: null,
          location: null,
          onlyAvailable: false,
        ),
      ),
    );

    final state = ref.watch(aiImageMatchControllerProvider);
    final ctrl = ref.read(aiImageMatchControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Pet Matching'),
      ),
      body: petsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load pets:\n$e')),
        data: (pets) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Upload an image and we’ll find the most similar pets.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 12),

              // ✅ NEW: Type dropdown
              Row(
                children: [
                  const Text(
                    'Type:',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: state.queryType,
                      items: _types
                          .map(
                            (t) => DropdownMenuItem(
                              value: t,
                              child: Text(t.toUpperCase()),
                            ),
                          )
                          .toList(),
                      onChanged: state.isLoading
                          ? null
                          : (v) {
                              if (v != null) ctrl.setQueryType(v);
                            },
                      decoration: const InputDecoration(
                        isDense: true,
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              _UploadCard(
                isBusy: state.isLoading,
                selectedImage: state.queryImage,
                onPick: () => ctrl.pickQueryImage(),
                onClear: state.queryImage == null ? null : () => ctrl.clear(),
                onCompare: state.queryImage == null || state.isLoading
                    ? null
                    : () => ctrl.compareAgainstPets(pets),
              ),

              const SizedBox(height: 16),

              if (state.errorMessage != null) ...[
                Text(
                  state.errorMessage!,
                  style: const TextStyle(color: Colors.red),
                ),
                const SizedBox(height: 12),
              ],

              if (state.isLoading) ...[
                const Center(child: CircularProgressIndicator()),
                const SizedBox(height: 12),
              ],

              if (!state.isLoading && state.results.isEmpty) ...[
                const Text('No results yet. Upload an image then press Compare.'),
              ],

              if (state.results.isNotEmpty) ...[
                const Text(
                  'Top Matches',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ...state.results.map((r) => _ResultTile(result: r)),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({
    required this.isBusy,
    required this.selectedImage,
    required this.onPick,
    required this.onCompare,
    required this.onClear,
  });

  final bool isBusy;
  final File? selectedImage;
  final VoidCallback onPick;
  final VoidCallback? onCompare;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            if (selectedImage != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  selectedImage!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 10),
            ] else ...[
              Container(
                height: 180,
                width: double.infinity,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey),
                ),
                child: const Center(child: Text('No image selected')),
              ),
              const SizedBox(height: 10),
            ],
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: isBusy ? null : onPick,
                    icon: const Icon(Icons.photo),
                    label: const Text('Pick Image'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: onCompare,
                    icon: const Icon(Icons.auto_awesome),
                    label: const Text('Compare'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: isBusy ? null : onClear,
                child: const Text('Clear'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.result});

  final AiPetMatchResult result;

  @override
  Widget build(BuildContext context) {
    final Pet pet = result.pet;
    final photo = pet.photoUrls.isNotEmpty ? pet.photoUrls.first : null;

    return Card(
      child: ListTile(
        leading: photo == null
            ? const CircleAvatar(child: Icon(Icons.pets))
            : CircleAvatar(backgroundImage: NetworkImage(photo)),
        title: Text(pet.name),
        subtitle: Text('${pet.type} • ${pet.location ?? ''}'),
        trailing: Text('${(result.similarity * 100).toStringAsFixed(0)}%'),
      ),
    );
  }
}
