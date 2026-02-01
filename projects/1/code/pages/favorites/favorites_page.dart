import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/constants/app_sizes.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_indicator.dart';

import '../../providers/favorites/favorites_provider.dart';
import '../../widgets/pets/pet_card.dart';

class FavoritesPage extends ConsumerWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favoritesAsync = ref.watch(favoritePetsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Favorites'),
      ),
      body: favoritesAsync.when(
        loading: () => const Center(child: LoadingIndicator()),
        error: (e, _) => ErrorView(message: e.toString()),
        data: (pets) {
          if (pets.isEmpty) {
            return const Center(
              child: Text('No favorite pets yet'),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(AppSizes.screenPadding),
            itemCount: pets.length,
            separatorBuilder: (_, _) =>
                const SizedBox(height: AppSizes.listItemSpacing),
            itemBuilder: (context, i) {
              final pet = pets[i];

              return PetCard(
                id: pet.id,
                name: pet.name,
                type: pet.type,
                location: pet.location,
                imageUrl: pet.photoUrls.isNotEmpty ? pet.photoUrls.first : null,
                isAdopted: pet.isAdopted,
                onTap: () {
                  
                  context.push(
                    AppRoutes.petDetails.replaceFirst(':id', pet.id),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
