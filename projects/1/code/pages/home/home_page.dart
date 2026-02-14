import 'package:flutter/material.dart';
import 'package:flutter_application_1/presentations/pages/adoption/adoption_hub_page.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../providers/profile/profile_providers.dart';
import '../../providers/auth/auth_providers.dart';

import '../notifications/notifications_center_page.dart';
import '../chat/chat_list_page.dart';
import '../favorites/favorites_page.dart';
import '../pets/pet_list_page.dart';
// ✅ NEW: theme toggle provider
import '../../providers/theme/theme_mode_provider.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialTab;
  }


  @override
  Widget build(BuildContext context) {
    final tabs = <Widget>[
      const _PetsTab(),
      const FavoritesPage(),
      const _AdoptionTab(),
      const ChatListPage(),
      const _ProfileTab(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pawtopia'),
        actions: [
        // AI icon in AppBar
          IconButton(
            tooltip: 'AI Matching',
            onPressed: () => context.push(AppRoutes.aiMatching),
            icon: const Icon(Icons.auto_awesome),
          ),
          //Notifications in AppBar
          Consumer(
            builder: (context, ref, _) {
              final unread = ref.watch(unreadNotificationsCountProvider);

              return IconButton(
                tooltip: 'Notifications',
                onPressed: () => context.push(AppRoutes.notifications),
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.notifications),
                    if (unread > 0)
                      Positioned(
                        right: -2,
                        top: -2,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.red,
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),  
          ],
        
      ),
      body: IndexedStack(
        index: _index,
        children: tabs,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.pets), label: 'Pets'),
          NavigationDestination(icon: Icon(Icons.favorite), label: 'Favorites'),
          NavigationDestination(icon: Icon(Icons.assignment), label: 'Adoption'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

/* -------------------- TABS -------------------- */

class _PetsTab extends StatelessWidget {
  const _PetsTab();

  @override
  Widget build(BuildContext context) {
    return const PetListPage();
  }
}

class _AdoptionTab extends StatelessWidget {
  const _AdoptionTab();

  @override
  Widget build(BuildContext context) {
    return const AdoptionHubPage();
  }
}

class _ProfileTab extends ConsumerWidget {
  const _ProfileTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final firebaseUser = FirebaseAuth.instance.currentUser;

    if (firebaseUser == null) {
      return const Center(child: Text('Not logged in'));
    }

    final profileAsync = ref.watch(profileStreamProvider(firebaseUser.uid));
    
    return profileAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Profile error:\n$e')),
      data: (profile) {
        final name = profile.displayName ?? profile.fullName;
        final email = profile.email;

        // ✅ Read current theme mode here
        final themeMode = ref.watch(themeModeProvider);
        final unread = ref.watch(unreadNotificationsCountProvider);

        
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 40,
                backgroundImage:
                    (profile.photoUrl != null && profile.photoUrl!.isNotEmpty)
                        ? NetworkImage(profile.photoUrl!)
                        : null,
                child: (profile.photoUrl == null || profile.photoUrl!.isEmpty)
                    ? const Icon(Icons.person, size: 40)
                    : null,
              ),
              const SizedBox(height: 16),

              Text(
                name,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),

              Text(
                email,
                style: Theme.of(context).textTheme.bodyMedium,
              ),

              const SizedBox(height: 20),

              if ((profile.phoneNumber ?? '').isNotEmpty)
                Text('Phone: ${profile.phoneNumber}'),

              if ((profile.city ?? '').isNotEmpty) Text('City: ${profile.city}'),

              if ((profile.bio ?? '').isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('Bio: ${profile.bio}'),
              ],

              const Divider(height: 20, thickness: 2,),
            
              


              const SizedBox(height: 12),

              // ✅ NEW: Theme toggle button ABOVE Sign Out
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                ),
                onPressed: () {
                  // Toggle between Light and Dark
                  ref.read(themeModeProvider.notifier).state =
                      (themeMode == ThemeMode.dark)
                          ? ThemeMode.light
                          : ThemeMode.dark;
                },
                icon: Icon(
                  themeMode == ThemeMode.dark
                      ? Icons.dark_mode
                      : Icons.light_mode,
                ),
                label: Text(
                  themeMode == ThemeMode.dark
                      ? 'Dark Mode: ON'
                      : 'Dark Mode: OFF',
                ),
              ),

              const SizedBox(height: 16),

              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                ),
                onPressed: () async {
                  await ref.read(authControllerProvider.notifier).signOut();

                  if (!context.mounted) return;

                  context.go(AppRoutes.login);
                },
                icon: const Icon(Icons.logout),
                label: const Text('Sign Out'),
              ),
            ],
          ),
        );
      },
    );
  }
}










