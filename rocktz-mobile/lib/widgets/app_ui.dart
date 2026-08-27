import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme/app_colors.dart';

class SoftCard extends StatelessWidget {
  const SoftCard({super.key, required this.child, this.padding, this.onTap, this.color});

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color ?? Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.zPurple.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) {
      return body;
    }
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: body,
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, this.light = false});

  final String label;
  final bool light;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: light ? Colors.white.withValues(alpha: 0.22) : AppColors.indigo.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: GoogleFonts.nunito(
          fontWeight: FontWeight.w800,
          fontSize: 12,
          color: light ? Colors.white : AppColors.indigo,
        ),
      ),
    );
  }
}

class EmptyHint extends StatelessWidget {
  const EmptyHint(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: GoogleFonts.nunito(color: AppColors.muted, fontSize: 16, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class DarkPillButton extends StatelessWidget {
  const DarkPillButton({super.key, required this.label, required this.onPressed, this.busy = false});

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.ink,
          foregroundColor: Colors.white,
          shape: const StadiumBorder(),
        ),
        child: busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
              )
            : Text(label, style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 16)),
      ),
    );
  }
}

InputDecoration softField(String label) {
  return InputDecoration(
    labelText: label,
    filled: true,
    fillColor: const Color(0xFFF4F4F5),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide.none),
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
  );
}

class PinnedHeroBody extends StatelessWidget {
  const PinnedHeroBody({
    super.key,
    required this.hero,
    required this.children,
    this.onRefresh,
  });

  final Widget hero;
  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
      children: children,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        hero,
        Expanded(
          child: onRefresh == null
              ? list
              : RefreshIndicator(onRefresh: onRefresh!, child: list),
        ),
      ],
    );
  }
}

class PageHero extends StatelessWidget {
  const PageHero({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.showBack = false,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
      decoration: const BoxDecoration(gradient: AppColors.welcome),
      child: SafeArea(
        bottom: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (showBack)
              IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
              ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(showBack ? 0 : 8, 8, 8, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.nunito(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        subtitle!,
                        style: GoogleFonts.nunito(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    );
  }
}

class CreatorNavBar extends StatelessWidget {
  const CreatorNavBar({
    super.key,
    required this.index,
    required this.unread,
    required this.labels,
    required this.onSelect,
  });

  final int index;
  final int unread;
  final List<String> labels;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    const icons = [
      Icons.home_outlined,
      Icons.auto_awesome_outlined,
      Icons.work_outline,
      Icons.notifications_none_rounded,
      Icons.person_outline,
    ];
    const active = [
      Icons.home_rounded,
      Icons.auto_awesome,
      Icons.work,
      Icons.notifications_rounded,
      Icons.person_rounded,
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 20, offset: const Offset(0, -4)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 6),
          child: Row(
            children: [
              for (var i = 0; i < 5; i++)
                Expanded(
                  child: _NavItem(
                    label: labels[i],
                    icon: index == i ? active[i] : icons[i],
                    selected: index == i,
                    badge: i == 3 ? unread : 0,
                    onTap: () => onSelect(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.selected,
    required this.badge,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.ink : AppColors.muted;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Badge(
              isLabelVisible: badge > 0,
              label: Text('$badge', style: const TextStyle(fontSize: 10)),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.nunito(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SegmentPills extends StatelessWidget {
  const SegmentPills({super.key, required this.labels, required this.index, required this.onChanged});

  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++)
          Padding(
            padding: EdgeInsets.only(right: i == labels.length - 1 ? 0 : 8),
            child: GestureDetector(
              onTap: () => onChanged(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: index == i ? AppColors.ink : Colors.white,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  labels[i],
                  style: GoogleFonts.nunito(
                    fontWeight: FontWeight.w800,
                    color: index == i ? Colors.white : AppColors.ink,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
