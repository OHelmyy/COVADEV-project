import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../providers/auth/auth_providers.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage> {
  bool _navigated = false;

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(firebaseUserProvider);

    // Navigate once when auth stream resolves
    authAsync.when(
      data: (user) {
        if (_navigated) return;
        _navigated = true;

        WidgetsBinding.instance.addPostFrameCallback((_) {
          // Not logged in
          if (user == null) {
            context.go(AppRoutes.login);
            return;
          }

          // Logged in: role based routing
          // Your domain.UserRole has helpers like isAdmin/isShelter/canManagePets
          // user is firebase_auth.User
        
        context.go(AppRoutes.authGate);

        });
      },
      loading: () {},
      error: (_, __) {
        if (_navigated) return;
        _navigated = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          // If auth stream errors, go to login (safe fallback)
          context.go(AppRoutes.login);
        });
      },
    );

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
            
              const Icon(Icons.pets, size: 72),

              const SizedBox(height: 16),
              Text(
                'Pawtopia',
                style: Theme.of(context).textTheme.headlineSmall,
              ),

              const SizedBox(height: 8),
              Text(
                'Loading...',
                style: Theme.of(context).textTheme.bodyMedium,
              ),

              const SizedBox(height: 24),
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
