import { Column as ColumnType, Card } from '../services/api';
import CardForm from './CardForm';

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  boardId: number;
  onCardCreated: (card: Card) => void;
}

export default function Column({ column, cards, boardId, onCardCreated }: ColumnProps) {
  return (
    <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#f9f9f9' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 'bold', borderBottom: '2px solid #007bff', paddingBottom: '6px' }}>
        {column.name}
      </h3>
      <div style={{ flex: 1 }}>
        {cards.map((card) => (
          <div key={card.id} style={{ padding: '8px', marginBottom: '8px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{card.content}</p>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>
              {card.author} · {new Date(card.created_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
      <CardForm boardId={boardId} columnId={column.id} onCardCreated={onCardCreated} />
    </div>
  );
}
