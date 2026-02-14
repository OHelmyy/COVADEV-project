import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_sizes.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_indicator.dart';

import '../../providers/pets/pet_list_controller.dart';
import '../../providers/pets/pet_providers.dart';
import '../../widgets/pets/pet_card.dart';

// ✅ Import the PetFormResult types from the SAME file (no new files)
import 'pet_form_page.dart';

class PetListPage extends ConsumerStatefulWidget {
  const PetListPage({super.key});

  @override
  ConsumerState<PetListPage> createState() => _PetListPageState();
}

class _PetListPageState extends ConsumerState<PetListPage> {
  String? _type;
  bool _onlyAvailable = true;

  void _showUndoSnackBar(PetFormResult res) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();

    final deletePet = ref.read(deletePetUseCaseProvider);
    final updatePet = ref.read(updatePetUseCaseProvider);

    if (res is PetCreatedResult) {
      final controller = messenger.showSnackBar(
        SnackBar(
          content: const Text('Pet added'),
          action: SnackBarAction(
            label: 'UNDO',
            onPressed: () async {
              try {
                await deletePet(res.createdPetId);
              } catch (e) {
                if (!mounted) return;
                messenger.hideCurrentSnackBar();
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('Undo failed'),
                    duration: Duration(seconds: 2),
                  ),
                );
              }
            },
          ),
        ),
      );

      // ✅ Force dismiss after 2 seconds even if UNDO exists
      Future.delayed(const Duration(seconds: 2), () {
        if (!mounted) return;
        controller.close();
      });
    } else if (res is PetUpdatedResult) {
      final controller = messenger.showSnackBar(
        SnackBar(
          content: const Text('Pet updated'),
          action: SnackBarAction(
            label: 'UNDO',
            onPressed: () async {
              try {
                await updatePet(res.before);
              } catch (e) {
                if (!mounted) return;
                messenger.hideCurrentSnackBar();
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('Undo failed'),
                    duration: Duration(seconds: 2),
                  ),
                );
              }
            },
          ),
        ),
      );

      // ✅ Force dismiss after 2 seconds even if UNDO exists
      Future.delayed(const Duration(seconds: 2), () {
        if (!mounted) return;
        controller.close();
      });
    }
  }

  Future<void> _openAddPet() async {
    // ✅ Await result from PetFormPage route
    final res = await context.push<PetFormResult>(AppRoutes.addPet);
    if (!mounted) return;
    if (res != null) _showUndoSnackBar(res);
  }

  @override
  Widget build(BuildContext context) {
    final filter = PetsStreamFilter(type: _type, onlyAvailable: _onlyAvailable);
    final petsAsync = ref.watch(petsStreamProvider(filter));

    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.petsTitle),
        actions: [
          IconButton(
            tooltip: _onlyAvailable ? 'Show all pets' : 'Show available only',
            icon: Icon(_onlyAvailable ? Icons.check_circle : Icons.list),
            onPressed: () => setState(() => _onlyAvailable = !_onlyAvailable),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAddPet,
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          _PetFilterBar(
            selectedType: _type,
            onTypeChanged: (t) => setState(() => _type = t),
          ),
          Expanded(
            child: petsAsync.when(
              loading: () => const Center(child: LoadingIndicator()),
              error: (e, _) => ErrorView(
                message: e.toString(),
                onRetry: () => ref.invalidate(petsStreamProvider(filter)),
              ),
              data: (pets) {
                final uiPets = pets.map(PetSummaryUiModel.fromEntity).toList();

                if (uiPets.isEmpty) {
                  return Center(child: Text(AppStrings.noPetsFound));
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(petsStreamProvider(filter));
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(AppSizes.screenPadding),
                    itemCount: uiPets.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: AppSizes.listItemSpacing),
                    itemBuilder: (context, i) => PetCard(
                      id: uiPets[i].id,
                      name: uiPets[i].name,
                      type: uiPets[i].type,
                      location: uiPets[i].location,
                      imageUrl: uiPets[i].thumbnailUrl,
                      isAdopted: uiPets[i].isAdopted,
                      onTap: () async {
                        final res = await context.push<PetFormResult>(
                          AppRoutes.petDetails.replaceFirst(':id', uiPets[i].id),
                        );
                        if (!context.mounted) return;
                        if (res != null) _showUndoSnackBar(res);
                      },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _PetFilterBar extends StatelessWidget {
  const _PetFilterBar({
    required this.selectedType,
    required this.onTypeChanged,
  });

  final String? selectedType;
  final ValueChanged<String?> onTypeChanged;

  @override
  Widget build(BuildContext context) {
    final types = ['All', 'Dog', 'Cat', 'Bird', 'Other'];

    String dropdownValue() {
      if (selectedType == null) return 'All';
      return selectedType!.capitalize();
    }

    return Padding(
      padding: const EdgeInsets.all(AppSizes.screenPadding),
      child: DropdownButtonFormField<String>(
        initialValue: dropdownValue(),
        decoration: const InputDecoration(labelText: 'Type'),
        items: types
            .map((t) => DropdownMenuItem(value: t, child: Text(t)))
            .toList(),
        onChanged: (value) {
          if (value == null || value == 'All') {
            onTypeChanged(null);
          } else {
            onTypeChanged(value.toLowerCase());
          }
        },
      ),
    );
  }
}

extension on String {
  String capitalize() => isEmpty ? this : this[0].toUpperCase() + substring(1);
}
