import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../providers/auth/auth_state_provider.dart';
import '../../providers/auth/user_role_provider.dart';

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authStateProvider);

    return authAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),

      error: (_, __) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          context.go(AppRoutes.login);
        });
        return const SizedBox.shrink();
      },

      data: (firebaseUser) {
        // ❌ مش logged in
        if (firebaseUser == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            context.go(AppRoutes.login);
          });
          return const SizedBox.shrink();
        }

        // ✅ logged in → نجيب role
        final roleAsync = ref.watch(userRoleProvider);

        return roleAsync.when(
          loading: () => const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          ),

          error: (_, __) {
            // fallback
            WidgetsBinding.instance.addPostFrameCallback((_) {
              context.go(AppRoutes.home);
            });
            return const SizedBox.shrink();
          },

          data: (role) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (role == 'admin') {
                context.go(AppRoutes.adminDashboard);
              } else {
                context.go(AppRoutes.home);
              }
            });
            return const SizedBox.shrink();
          },
        );
      },
    );
  }
}
