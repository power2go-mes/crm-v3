import type { EChartsOption } from 'echarts';

export const secondaryChartTypes = ['stacked_vertical', 'stacked_horizontal', 'heatmap', 'sankey', 'radar'] as const;
type SecondaryType = typeof secondaryChartTypes[number];
type Point = { label: string; secondary?: string; value: number };

export function secondaryChartOptions(kind: SecondaryType, points: Point[]): EChartsOption {
  const labels = [...new Set(points.map(point => point.label))];
  const groups = [...new Set(points.flatMap(point => point.secondary === undefined ? [] : [point.secondary]))];
  const values = new Map(points.map(point => [JSON.stringify([point.label, point.secondary]), point.value]));
  const valueFor = (label: string, group?: string) => values.get(JSON.stringify([label, group])) ?? 0;
  const maximum = Math.max(1, ...points.map(point => point.value));
  const category = { type: 'category' as const, data: labels };
  const value = { type: 'value' as const, splitLine: { lineStyle: { type: 'dashed' as const } } };
  const legend = { bottom: 0, type: 'scroll' as const };

  if (kind === 'radar') {
    return {
      tooltip: { trigger: 'item', renderMode: 'richText' }, legend,
      radar: { indicator: labels.map(name => ({ name, max: maximum })), radius: '65%' },
      series: [{ type: 'radar', data: (groups.length ? groups : [undefined]).map(group => ({
        name: group ?? 'Leads', value: labels.map(label => valueFor(label, group)),
      })) }],
    };
  }
  if (kind === 'sankey') {
    const links = points.filter(point => point.secondary !== undefined && point.value > 0);
    const names = new Map<string, string>();
    for (const point of links) {
      names.set('left:' + point.label, point.label);
      names.set('right:' + point.secondary, point.secondary ?? '');
    }
    return {
      tooltip: { trigger: 'item', renderMode: 'richText' },
      series: [{ type: 'sankey', data: [...names.keys()].map(name => ({ name })),
        label: { formatter: item => names.get(item.name) ?? '' },
        links: links.map(point => ({ source: 'left:' + point.label, target: 'right:' + point.secondary, value: point.value })),
        lineStyle: { color: 'gradient', opacity: 0.5 },
      }],
    };
  }
  if (kind === 'heatmap') {
    return {
      tooltip: { trigger: 'item', renderMode: 'richText' }, xAxis: category,
      yAxis: { type: 'category', data: groups },
      visualMap: { min: 0, max: maximum, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#eef2ff', '#818cf8', '#4338ca'] } },
      series: [{ type: 'heatmap', data: points.map(point => [labels.indexOf(point.label), groups.indexOf(point.secondary ?? ''), point.value]) }],
    };
  }
  return {
    tooltip: { trigger: 'axis', renderMode: 'richText' }, legend,
    xAxis: kind === 'stacked_horizontal' ? value : category,
    yAxis: kind === 'stacked_horizontal' ? category : value,
    series: groups.map(name => ({ type: 'bar', name, stack: 'leads', data: labels.map(label => valueFor(label, name)) })),
  };
}
