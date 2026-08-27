import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme/app_colors.dart';

class AudienceBarChart extends StatelessWidget {
  const AudienceBarChart({super.key, required this.rows});

  final List<Map<String, dynamic>> rows;

  static const _colors = {
    'instagram': Color(0xFFE1306C),
    'tiktok': Color(0xFF111827),
    'youtube': Color(0xFFFF0000),
    'kwai': Color(0xFFFF6A00),
  };

  static const _labels = {
    'instagram': 'IG',
    'tiktok': 'TT',
    'youtube': 'YT',
    'kwai': 'Kwai',
  };

  @override
  Widget build(BuildContext context) {
    final maxFollowers = rows.fold<double>(0, (m, row) {
      final v = (row['followers'] as num?)?.toDouble() ?? 0;
      return v > m ? v : m;
    });
    final top = maxFollowers <= 0 ? 1.0 : maxFollowers * 1.15;

    return BarChart(
      BarChartData(
        maxY: top,
        alignment: BarChartAlignment.spaceAround,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: top / 4,
          getDrawingHorizontalLine: (_) => FlLine(color: AppColors.line, strokeWidth: 1),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 36,
              getTitlesWidget: (value, _) => Text(
                compactNumber(value),
                style: GoogleFonts.nunito(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.muted),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, _) {
                final i = value.toInt();
                if (i < 0 || i >= rows.length) return const SizedBox.shrink();
                final network = '${rows[i]['network']}';
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _labels[network] ?? network,
                    style: GoogleFonts.nunito(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.ink),
                  ),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < rows.length; i++)
            BarChartGroupData(
              x: i,
              barRods: [
                BarChartRodData(
                  toY: (rows[i]['followers'] as num?)?.toDouble() ?? 0,
                  width: 18,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                  color: _colors['${rows[i]['network']}'] ?? AppColors.indigo,
                ),
              ],
            ),
        ],
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipColor: (_) => AppColors.ink,
            getTooltipItem: (group, _, rod, _) {
              final network = '${rows[group.x]['network']}';
              return BarTooltipItem(
                '${_labels[network] ?? network}\n${compactNumber(rod.toY)}',
                GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
              );
            },
          ),
        ),
      ),
    );
  }
}

class ActivityLineChart extends StatelessWidget {
  const ActivityLineChart({super.key, required this.points});

  final List<Map<String, dynamic>> points;

  @override
  Widget build(BuildContext context) {
    final maxValue = points.fold<double>(0, (m, row) {
      final v = (row['value'] as num?)?.toDouble() ?? 0;
      return v > m ? v : m;
    });
    final top = maxValue <= 0 ? 4.0 : (maxValue * 1.25).clamp(4, 1000);

    return LineChart(
      LineChartData(
        minY: 0,
        maxY: top.toDouble(),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: top / 4,
          getDrawingHorizontalLine: (_) => FlLine(color: AppColors.line, strokeWidth: 1),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              interval: 1,
              getTitlesWidget: (value, _) {
                if (value % 1 != 0) return const SizedBox.shrink();
                return Text(
                  value.toInt().toString(),
                  style: GoogleFonts.nunito(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.muted),
                );
              },
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 1,
              getTitlesWidget: (value, _) {
                final i = value.toInt();
                if (i < 0 || i >= points.length) return const SizedBox.shrink();
                final name = '${points[i]['name']}';
                final short = name.split(' ').first;
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    short,
                    style: GoogleFonts.nunito(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.ink),
                  ),
                );
              },
            ),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            isCurved: true,
            color: AppColors.indigo,
            barWidth: 3,
            dotData: const FlDotData(show: true),
            belowBarData: BarAreaData(
              show: true,
              color: AppColors.indigo.withValues(alpha: 0.12),
            ),
            spots: [
              for (var i = 0; i < points.length; i++)
                FlSpot(i.toDouble(), (points[i]['value'] as num?)?.toDouble() ?? 0),
            ],
          ),
        ],
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => AppColors.ink,
            getTooltipItems: (touched) => touched
                .map(
                  (spot) => LineTooltipItem(
                    '${points[spot.x.toInt()]['name']}\n${spot.y.toInt()}',
                    GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                )
                .toList(),
          ),
        ),
      ),
    );
  }
}

List<Map<String, dynamic>> audienceFromMetrics(dynamic raw) {
  final metrics = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
  num pick(List<String> keys) {
    for (final key in keys) {
      final value = metrics[key];
      if (value is num) return value;
    }
    return 0;
  }

  return [
    {
      'network': 'instagram',
      'followers': pick(['instagram_followers', 'followers']),
      'views': pick(['instagram_views', 'avgViews', 'avg_views']),
      'engagement': pick(['instagram_engagement', 'avgEngagement', 'engagement_rate']),
    },
    {
      'network': 'tiktok',
      'followers': pick(['tiktok_followers']),
      'views': pick(['tiktok_views']),
      'engagement': pick(['tiktok_engagement']),
    },
    {
      'network': 'youtube',
      'followers': pick(['youtube_followers', 'youtube_subscribers']),
      'views': pick(['youtube_views']),
      'engagement': pick(['youtube_engagement']),
    },
    {
      'network': 'kwai',
      'followers': pick(['kwai_followers']),
      'views': pick(['kwai_views']),
      'engagement': pick(['kwai_engagement']),
    },
  ];
}

String compactNumber(num value) {
  if (value >= 1000000) {
    return '${(value / 1000000).toStringAsFixed(value % 1000000 == 0 ? 0 : 1)}M';
  }
  if (value >= 1000) {
    return '${(value / 1000).toStringAsFixed(value % 1000 == 0 ? 0 : 1)}k';
  }
  if (value == value.roundToDouble()) {
    return value.round().toString();
  }
  return value.toStringAsFixed(1);
}

String formatBrl(num value) {
  final parts = value.toStringAsFixed(2).split('.');
  final ints = parts[0];
  final buf = StringBuffer();
  for (var i = 0; i < ints.length; i++) {
    final fromEnd = ints.length - i;
    buf.write(ints[i]);
    if (fromEnd > 1 && fromEnd % 3 == 1) {
      buf.write('.');
    }
  }
  return 'R\$ $buf,${parts[1]}';
}
