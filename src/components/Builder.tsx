import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SiteBlock } from '../types/domain';

type Props = {
  blocks: SiteBlock[];
  onChange: (blocks: SiteBlock[]) => void;
};

const presets: Omit<SiteBlock, 'id'>[] = [
  { type: 'hero', title: 'Hero', content: 'Titular potente para convertir', buttonText: 'Empezar', buttonUrl: '#' },
  { type: 'text', title: 'Texto', content: 'Describe tu propuesta de valor' },
  { type: 'features', title: 'Beneficios', content: 'Rapido, seguro, escalable' },
  { type: 'image', title: 'Imagen', content: 'Imagen principal', image: 'https://picsum.photos/1200/700' },
  { type: 'cta', title: 'Llamado a la accion', content: 'Convierte visitas en leads', buttonText: 'Contactar', buttonUrl: '#' },
];

function SortableItem({ block, onRemove }: { block: SiteBlock; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <article ref={setNodeRef} style={style} className="block-card" {...attributes} {...listeners}>
      <header>
        <strong>{block.title}</strong>
        <button type="button" onClick={() => onRemove(block.id)}>Eliminar</button>
      </header>
      <p>{block.content}</p>
    </article>
  );
}

export default function Builder({ blocks, onChange }: Props) {
  return (
    <section className="builder">
      <div className="presets">
        {presets.map((preset) => (
          <button
            key={preset.type}
            type="button"
            onClick={() => onChange(blocks.concat({ ...preset, id: crypto.randomUUID() }))}
          >
            + {preset.title}
          </button>
        ))}
      </div>
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          const oldIndex = blocks.findIndex((b) => b.id === active.id);
          const newIndex = blocks.findIndex((b) => b.id === over.id);
          onChange(arrayMove(blocks, oldIndex, newIndex));
        }}
      >
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="canvas">
            {blocks.map((block) => (
              <SortableItem
                key={block.id}
                block={block}
                onRemove={(id) => onChange(blocks.filter((b) => b.id !== id))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
