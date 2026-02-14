/*
import 'package:flutter/material.dart';

import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/empty_state.dart';

class UiKitPage extends StatefulWidget {
  const UiKitPage({super.key});

  @override
  State<UiKitPage> createState() => _UiKitPageState();
}

class _UiKitPageState extends State<UiKitPage> {
  final _formKey = GlobalKey<FormState>();

  final emailController = TextEditingController();
  final passController = TextEditingController();

  bool localLoading = false;

  @override
  void dispose() {
    emailController.dispose();
    passController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('UI Kit (Day 5 Test)')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Typography', style: textTheme.titleLarge),
          const SizedBox(height: 8),
          Text('This is body text', style: textTheme.bodyMedium),
          const SizedBox(height: 4),
          Text('This is caption text', style: textTheme.bodySmall),
          const Divider(height: 32),

          Text('Text Fields + Validation', style: textTheme.titleLarge),
          const SizedBox(height: 12),
          Form(
            key: _formKey,
            child: Column(
              children: [
                AppTextField(
                  controller: emailController,
                  label: 'Email',
                  hintText: 'name@example.com',
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  prefixIcon: Icons.email_outlined,
                  validator: (v) {
                    final value = (v ?? '').trim();
                    if (value.isEmpty) return 'Email is required';
                    if (!value.contains('@')) return 'Invalid email';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: passController,
                  label: 'Password',
                  hintText: 'Min 6 chars',
                  obscure: true, // tests password toggle
                  textInputAction: TextInputAction.done,
                  prefixIcon: Icons.lock_outline,
                  validator: (v) {
                    final value = (v ?? '');
                    if (value.isEmpty) return 'Password is required';
                    if (value.length < 6) return 'Too short';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                AppButton(
                  text: 'Validate Form',
                  icon: Icons.check_circle_outline,
                  onPressed: () {
                    final ok = _formKey.currentState?.validate() ?? false;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(ok ? 'Form OK ✅' : 'Form has errors ❌')),
                    );
                  },
                ),
              ],
            ),
          ),
          const Divider(height: 32),

          Text('Buttons', style: textTheme.titleLarge),
          const SizedBox(height: 12),

          AppButton(
            text: 'Primary Button',
            icon: Icons.pets,
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Primary pressed ✅')),
              );
            },
          ),
          const SizedBox(height: 12),

          AppButton(
            text: 'Secondary Button',
            variant: AppButtonVariant.secondary,
            icon: Icons.layers_outlined,
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Secondary pressed ✅')),
              );
            },
          ),
          const SizedBox(height: 12),

          AppButton(
            text: 'Danger Button',
            variant: AppButtonVariant.danger,
            icon: Icons.delete_outline,
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Danger pressed ⚠️')),
              );
            },
          ),
          const SizedBox(height: 12),

          AppButton(
            text: 'Loading Button',
            loading: true,
            onPressed: () {},
          ),
          const SizedBox(height: 12),

          AppButton(
            text: 'Disabled Button',
            onPressed: null,
          ),
          const SizedBox(height: 12),

          AppButton(
            text: localLoading ? 'Stop Local Loading' : 'Start Local Loading',
            onPressed: () => setState(() => localLoading = !localLoading),
          ),

          const Divider(height: 32),

          Text('State Widgets', style: textTheme.titleLarge),
          const SizedBox(height: 12),

          const SizedBox(height: 80, child: LoadingIndicator()),
          const SizedBox(height: 12),

          ErrorView(
            message: 'Sample error message ❌',
            onRetry: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Retry tapped ✅')),
              );
            },
          ),
          const SizedBox(height: 12),

          const EmptyState(text: 'Nothing here yet 👀'),
          const SizedBox(height: 24),

          Text(
            'If everything looks consistent and reusable, Day 5 is done ✅',
            style: textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
*/
