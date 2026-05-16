import type { SiteBlock } from '../types/domain';

type Props = {
  blocks: SiteBlock[];
  onChange: (blocks: SiteBlock[]) => void;
};

type PaletteItem = Omit<SiteBlock, 'id' | 'parentId' | 'nodeType'>;

const sectionPalette: PaletteItem = {
  type: 'section',
  title: 'Nueva seccion',
  content: 'Contenedor principal para elementos',
};

const elementPalette: PaletteItem[] = [
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

function toBuilderShape(blocks: SiteBlock[]): SiteBlock[] {
  const hasTree = blocks.some((b) => b.nodeType || b.type === 'section');
  if (hasTree) return blocks;
  const next: SiteBlock[] = [];
  for (const block of blocks) {
    const sectionId = crypto.randomUUID();
    next.push({ id: sectionId, type: 'section', nodeType: 'section', title: `Seccion ${next.length + 1}`, content: '' });
    next.push({ ...block, id: crypto.randomUUID(), parentId: sectionId, nodeType: 'element' });
  }
  return next;
}

function palettePayload(kind: 'section' | 'element', item?: PaletteItem): string {
  return JSON.stringify({ kind, item });
}

function updateBlock(blocks: SiteBlock[], id: string, patch: Partial<SiteBlock>): SiteBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

export default function Builder({ blocks, onChange }: Props) {
  const normalized = toBuilderShape(blocks);
  const sections = normalized.filter((b) => b.nodeType === 'section' || b.type === 'section');
  const childrenBySection = new Map<string, SiteBlock[]>();
  for (const section of sections) childrenBySection.set(section.id, normalized.filter((b) => b.parentId === section.id));

  function removeSection(sectionId: string) {
    onChange(normalized.filter((b) => b.id !== sectionId && b.parentId !== sectionId));
  }

  function removeElement(id: string) {
    onChange(normalized.filter((b) => b.id !== id));
  }

  function onDropBody(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/csmv2-item');
    if (!raw) return;
    const data = JSON.parse(raw) as { kind: 'section' | 'element'; item?: PaletteItem };
    if (data.kind !== 'section') return;
    const next: SiteBlock = {
      id: crypto.randomUUID(),
      nodeType: 'section',
      type: 'section',
      title: 'Nueva seccion',
      content: 'Seccion arrastrada al body',
    };
    onChange(normalized.concat(next));
  }

  function onDropSection(event: React.DragEvent<HTMLElement>, sectionId: string) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/csmv2-item');
    if (!raw) return;
    const data = JSON.parse(raw) as { kind: 'section' | 'element'; item?: PaletteItem };
    if (data.kind !== 'element' || !data.item) return;
    const element: SiteBlock = {
      ...data.item,
      id: crypto.randomUUID(),
      nodeType: 'element',
      parentId: sectionId,
    };
    onChange(normalized.concat(element));
  }

  return (
    <section className="builder-shell">
      <aside className="builder-sidebar">
        <h3>Componentes</h3>
        <p>Arrastra al canvas.</p>
        <div
          className="palette-item"
          draggable
          onDragStart={(event) => event.dataTransfer.setData('application/csmv2-item', palettePayload('section', sectionPalette))}
        >
          + Seccion
        </div>
        {elementPalette.map((item) => (
          <div
            key={item.type + item.title}
            className="palette-item"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('application/csmv2-item', palettePayload('element', item))}
          >
            + {item.title}
          </div>
        ))}
      </aside>

      <main className="builder-canvas" onDragOver={(event) => event.preventDefault()} onDrop={onDropBody}>
        <header>
          <strong>Canvas (body)</strong>
          <span>Solo acepta secciones. Dentro de cada seccion puedes soltar elementos.</span>
        </header>

        {sections.length === 0 && <div className="drop-empty">Arrastra una seccion aqui para iniciar.</div>}

        {sections.map((section, index) => {
          const items = childrenBySection.get(section.id) || [];
          return (
            <article key={section.id} className="canvas-section" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropSection(event, section.id)}>
              <div className="section-head">
                <strong>Seccion {index + 1}</strong>
                <button type="button" onClick={() => removeSection(section.id)}>Eliminar seccion</button>
              </div>
              <input value={section.title} onChange={(e) => onChange(updateBlock(normalized, section.id, { title: e.target.value }))} placeholder="Titulo de seccion" />
              <textarea value={section.content} onChange={(e) => onChange(updateBlock(normalized, section.id, { content: e.target.value }))} placeholder="Descripcion corta" />

              <div className="section-children">
                {items.length === 0 && <div className="drop-empty">Arrastra elementos aqui.</div>}
                {items.map((block) => (
                  <article key={block.id} className="block-card">
                    <header>
                      <strong>{block.title}</strong>
                      <button type="button" onClick={() => removeElement(block.id)}>Eliminar</button>
                    </header>
                    <input value={block.title} onChange={(e) => onChange(updateBlock(normalized, block.id, { title: e.target.value }))} placeholder="Titulo" />
                    <textarea value={block.content} onChange={(e) => onChange(updateBlock(normalized, block.id, { content: e.target.value }))} placeholder="Contenido" />
                    {(block.type === 'cta' || block.type === 'hero') && (
                      <div className="inline-fields">
                        <input value={block.buttonText || ''} onChange={(e) => onChange(updateBlock(normalized, block.id, { buttonText: e.target.value }))} placeholder="Texto boton" />
                        <input value={block.buttonUrl || ''} onChange={(e) => onChange(updateBlock(normalized, block.id, { buttonUrl: e.target.value }))} placeholder="URL boton" />
                      </div>
                    )}
                    {(block.type === 'gallery' || block.type === 'faq' || block.type === 'features' || block.type === 'navbar') && (
                      <textarea
                        value={(block.items || []).join('\n')}
                        onChange={(e) => onChange(updateBlock(normalized, block.id, { items: e.target.value.split('\n').filter(Boolean) }))}
                        placeholder="Items, uno por linea"
                      />
                    )}
                    {block.type === 'image' && <input value={block.image || ''} onChange={(e) => onChange(updateBlock(normalized, block.id, { image: e.target.value }))} placeholder="URL imagen" />}
                  </article>
                ))}
              </div>
            </article>
          );
        })}
      </main>
    </section>
  );
}
