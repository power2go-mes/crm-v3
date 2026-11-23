import { Children, isValidElement, type ReactNode } from 'react';

export function LeadFormGrid({ children, layout, keepVisible = [], access = {} }: {
  children: ReactNode;
  layout?: { field: string; sequence: number; visible: boolean }[] | null;
  keepVisible?: string[];
  access?: Record<string, string>;
}) {
  const positions = new Map(layout?.map(item => [item.field, item]));
  const fields = Children.toArray(children).map((node, index) => ({
    node, index,
    field: isValidElement<{ 'data-field'?: string }>(node) ? node.props['data-field'] : undefined,
  }));
  fields.sort((a, b) => (positions.get(a.field ?? '')?.sequence ?? Infinity)
    - (positions.get(b.field ?? '')?.sequence ?? Infinity) || a.index - b.index);
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {fields.filter(({ field }) => !field || (access[field] !== 'hidden'
      && (keepVisible.includes(field) || positions.get(field)?.visible !== false)))
      .map(({ node, field, index }) => field && access[field] === 'readonly'
        ? <fieldset key={index} disabled>{node}</fieldset> : node)}
  </div>;
}
