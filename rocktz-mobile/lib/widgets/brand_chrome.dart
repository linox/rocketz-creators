import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme/app_colors.dart';

class BrandBackdrop extends StatelessWidget {
  const BrandBackdrop({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(decoration: BoxDecoration(gradient: AppColors.welcome)),
        Positioned(
          top: -90,
          right: -50,
          child: _blob(220, Colors.white.withValues(alpha: 0.28)),
        ),
        Positioned(
          top: 180,
          left: -80,
          child: _blob(180, AppColors.zPurple.withValues(alpha: 0.18)),
        ),
        Positioned(
          bottom: 40,
          right: -70,
          child: _blob(200, const Color(0xFFFFF1F2).withValues(alpha: 0.35)),
        ),
        child,
      ],
    );
  }

  Widget _blob(double size, Color color) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}

class GlassLogoMark extends StatelessWidget {
  const GlassLogoMark({super.key, this.size = 128});

  final double size;

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.28;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.22),
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: Colors.white.withValues(alpha: 0.5), width: 1.2),
          ),
          child: Text(
            'z',
            style: GoogleFonts.nunito(
              fontSize: size * 0.52,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1,
            ),
          ),
        ),
      ),
    );
  }
}

class CreatorzWordmark extends StatelessWidget {
  const CreatorzWordmark({super.key, this.light = true, this.size = 36});

  final bool light;
  final double size;

  @override
  Widget build(BuildContext context) {
    final base = GoogleFonts.nunito(
      fontSize: size,
      fontWeight: FontWeight.w800,
      height: 1,
      letterSpacing: -0.8,
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        RichText(
          text: TextSpan(
            style: base.copyWith(color: light ? Colors.white : AppColors.ink),
            children: [
              const TextSpan(text: 'creator'),
              TextSpan(
                text: 'z',
                style: TextStyle(color: light ? Colors.white : AppColors.zPurple),
              ),
            ],
          ),
        ),
        Text(
          'by rocketz',
          style: GoogleFonts.nunito(
            fontSize: size * 0.32,
            fontWeight: FontWeight.w600,
            color: light ? Colors.white.withValues(alpha: 0.82) : const Color(0xFF6B7280),
          ),
        ),
      ],
    );
  }
}

class PillButton extends StatelessWidget {
  const PillButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.filled = true,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool filled;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? SizedBox(
            height: 22,
            width: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.4,
              color: filled ? AppColors.ink : Colors.white,
            ),
          )
        : Text(
            label,
            style: GoogleFonts.nunito(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: filled ? AppColors.ink : Colors.white,
            ),
          );

    return SizedBox(
      width: double.infinity,
      height: 56,
      child: filled
          ? FilledButton(
              onPressed: busy ? null : onPressed,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.ink,
                disabledBackgroundColor: Colors.white.withValues(alpha: 0.7),
                shape: const StadiumBorder(),
                elevation: 0,
              ),
              child: child,
            )
          : OutlinedButton(
              onPressed: busy ? null : onPressed,
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.white.withValues(alpha: 0.55)),
                backgroundColor: Colors.white.withValues(alpha: 0.16),
                shape: const StadiumBorder(),
              ),
              child: child,
            ),
    );
  }
}
