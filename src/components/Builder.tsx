import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SiteBlock } from '../types/domain';

type Props = {
  blocks: SiteBlock[];
  onChange: (blocks: SiteBlock[]) => void;
};

const presets: Omit<SiteBlock, 'id'>[] = [
  { type: 'navbar', title: 'Navbar', content: 'Inicio|Servicios|Contacto' },
  { type: 'hero', title: 'Hero', content: 'Construye sin limites', buttonText: 'Comenzar', buttonUrl: '#' },
  { type: 'text', title: 'Texto', content: 'Bloque de texto editable' },
  { type: 'features', title: 'Beneficios', content: 'Rapido, seguro, flexible', items: ['Sin backend', 'Publicacion GitHub', 'Plantillas'] },
  { type: 'gallery', title: 'Galeria', content: 'Muestra tus trabajos', items: ['https://picsum.photos/500/300', 'https://picsum.photos/501/300'] },
  { type: 'faq', title: 'FAQ', content: 'Preguntas frecuentes', items: ['Que incluye?:Editor visual completo', 'Como publico?:Con GitHub Actions'] },
  { type: 'image', title: 'Imagen', content: 'Hero visual', image: 'https://picsum.photos/1200/700' },
  { type: 'contactForm', title: 'Formulario', content: 'Recibe leads desde tu landing' },
  { type: 'cta', title: 'Llamado a la accion', content: 'Convierte visitas en clientes', buttonText: 'Contactar', buttonUrl: '#' },
];

function SortableItem({ block, onRemove, onPatch }: { block: SiteBlock; onRemove: (id: string) => void; onPatch: (id: string, patch: Partial<SiteBlock>) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <article ref={setNodeRef} style={style} className="block-card" {...attributes} {...listeners}>
      <header>
        <strong>{block.title}</strong>
        <button type="button" onClick={() => onRemove(block.id)}>Eliminar</button>
      </header>
      <input value={block.title} onChange={(e) => onPatch(block.id, { title: e.target.value })} placeholder="Titulo" />
      <textarea value={block.content} onChange={(e) => onPatch(block.id, { content: e.target.value })} placeholder="Contenido" />
      {(block.type === 'cta' || block.type === 'hero') && (
        <div className="inline-fields">
          <input value={block.buttonText || ''} onChange={(e) => onPatch(block.id, { buttonText: e.target.value })} placeholder="Texto boton" />
          <input value={block.buttonUrl || ''} onChange={(e) => onPatch(block.id, { buttonUrl: e.target.value })} placeholder="URL boton" />
        </div>
      )}
      {(block.type === 'gallery' || block.type === 'faq' || block.type === 'features' || block.type === 'navbar') && (
        <textarea
          value={(block.items || []).join('\n')}
          onChange={(e) => onPatch(block.id, { items: e.target.value.split('\n').filter(Boolean) })}
          placeholder="Items, uno por linea"
        />
      )}
      {block.type === 'image' && (
        <input value={block.image || ''} onChange={(e) => onPatch(block.id, { image: e.target.value })} placeholder="URL imagen" />
      )}
    </article>
  );
}

export default function Builder({ blocks, onChange }: Props) {
  return (
    <section className="builder">
      <div className="presets">
        {presets.map((preset) => (
          <button key={preset.type + preset.title} type="button" onClick={() => onChange(blocks.concat({ ...preset, id: crypto.randomUUID() }))}>
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
                onPatch={(id, patch) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
