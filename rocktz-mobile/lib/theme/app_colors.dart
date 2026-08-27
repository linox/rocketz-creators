import 'package:flutter/material.dart';

class AppColors {
  static const indigo = Color(0xFF6366F1);
  static const zPurple = Color(0xFF8A3FFC);
  static const ink = Color(0xFF1C1C1E);
  static const canvas = Color(0xFFF6F4FA);
  static const muted = Color(0xFF6B7280);
  static const line = Color(0xFFE8E4F0);

  static const gradientTop = Color(0xFF8EC8FF);
  static const gradientMid = Color(0xFFC4B5FD);
  static const gradientPink = Color(0xFFF0ABD4);
  static const gradientPeach = Color(0xFFF8C4C8);

  static const LinearGradient welcome = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gradientTop, gradientMid, gradientPink, gradientPeach],
    stops: [0.0, 0.38, 0.72, 1.0],
  );
}
