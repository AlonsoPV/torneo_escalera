import { describe, expect, it } from 'vitest'

import {
  buildPromotionTierLadderEntries,
  comparePromotionRowsForGroupAssignment,
  getMaxPromotionTier,
  getPromotionTierRankForGroup,
  getTargetGroupOrder,
  isMbBottomTierGroupName,
  orderIndexForTierRank,
  parseGroupNameTierNumber,
  promotionTierLabel,
  targetSeedOrderForPromotionRow,
  validatePromotionPreviewCascade,
} from '@/utils/nextTournamentPromotion'

describe('parseGroupNameTierNumber', () => {
  it('extrae el número del nombre del grupo', () => {
    expect(parseGroupNameTierNumber('GRUPO 1')).toBe(1)
    expect(parseGroupNameTierNumber('GRUPO 15')).toBe(15)
    expect(parseGroupNameTierNumber('grupo 16')).toBe(16)
    expect(parseGroupNameTierNumber('GRUPO MB')).toBe(null)
  })
})

describe('buildPromotionTierLadderEntries', () => {
  it('nivel = número del nombre, no order_index (caso reportado)', () => {
    const groups = [
      { id: 'g1', order_index: 12, name: 'GRUPO 1', players: [1] },
      { id: 'g2', order_index: 13, name: 'GRUPO 2', players: [1] },
      { id: 'g15', order_index: 0, name: 'GRUPO 15', players: [1] },
      { id: 'g16', order_index: 1, name: 'GRUPO 16', players: [1] },
    ]
    const entries = buildPromotionTierLadderEntries(groups)
    expect(getPromotionTierRankForGroup(entries, 'g1')).toBe(1)
    expect(getPromotionTierRankForGroup(entries, 'g2')).toBe(2)
    expect(getPromotionTierRankForGroup(entries, 'g15')).toBe(15)
    expect(getPromotionTierRankForGroup(entries, 'g16')).toBe(16)
    expect(promotionTierLabel(1, 'GRUPO 1', 16)).toBe('Nivel 1 de 16')
    expect(promotionTierLabel(15, 'GRUPO 15', 16)).toBe('Nivel 15 de 16')
  })

  it('20 grupos GRUPO 1–19 + MB: MB es nivel 20', () => {
    const groups = Array.from({ length: 19 }, (_, i) => ({
      id: `g${i + 1}`,
      order_index: i,
      name: `GRUPO ${i + 1}`,
      players: [1],
    }))
    groups.push({ id: 'gmb', order_index: 99, name: 'GRUPO MB', players: [1] })

    const entries = buildPromotionTierLadderEntries(groups)
    expect(entries).toHaveLength(20)
    expect(getPromotionTierRankForGroup(entries, 'g1')).toBe(1)
    expect(getPromotionTierRankForGroup(entries, 'g19')).toBe(19)
    expect(getPromotionTierRankForGroup(entries, 'gmb')).toBe(20)
    expect(getMaxPromotionTier(entries)).toBe(20)
    expect(promotionTierLabel(20, 'GRUPO MB', 20)).toBe('Nivel 20 de 20 (MB)')
  })

  it('cascada GRUPO 15 pos 4 baja a GRUPO 16', () => {
    const groups = [
      { id: 'g15', order_index: 0, name: 'GRUPO 15', players: [1] },
      { id: 'g16', order_index: 1, name: 'GRUPO 16', players: [1] },
    ]
    const entries = buildPromotionTierLadderEntries(groups)
    const move = getTargetGroupOrder(15, 4, 1, getMaxPromotionTier(entries))
    expect(move.targetGroupOrder).toBe(16)
    expect(orderIndexForTierRank(entries, 16)).toBe(1)
  })
})

describe('targetSeedOrderForPromotionRow', () => {
  it('bajan al 1.º y 2.º lugar del grupo destino', () => {
    expect(targetSeedOrderForPromotionRow({ fromPosition: 4, movementType: 'demote' })).toBe(0)
    expect(targetSeedOrderForPromotionRow({ fromPosition: 5, movementType: 'demote' })).toBe(1)
  })

  it('suben al 4.º y 5.º lugar del grupo destino', () => {
    expect(targetSeedOrderForPromotionRow({ fromPosition: 1, movementType: 'promote' })).toBe(3)
    expect(targetSeedOrderForPromotionRow({ fromPosition: 2, movementType: 'promote' })).toBe(4)
  })

  it('3.º se queda en el centro del grupo', () => {
    expect(targetSeedOrderForPromotionRow({ fromPosition: 3, movementType: 'stay' })).toBe(2)
  })
})

describe('comparePromotionRowsForGroupAssignment', () => {
  it('ordena bajistas antes que subistas en el mismo grupo destino', () => {
    const demoted = {
      fromPosition: 4,
      movementType: 'demote' as const,
      points: 1,
      gamesFor: 0,
      gamesDifference: 0,
      displayName: 'Baja',
    }
    const promoted = {
      fromPosition: 1,
      movementType: 'promote' as const,
      points: 9,
      gamesFor: 0,
      gamesDifference: 0,
      displayName: 'Sube',
    }
    expect(comparePromotionRowsForGroupAssignment(demoted, promoted)).toBeLessThan(0)
  })
})

describe('getTargetGroupOrder cascada', () => {
  it('GRUPO 1 tope superior: pos 1–2 no suben', () => {
    expect(getTargetGroupOrder(1, 1, 1, 20)).toMatchObject({ targetGroupOrder: 1, movementType: 'capped_top' })
  })

  it('GRUPO MB (20) tope inferior: pos 4–5 no bajan', () => {
    expect(getTargetGroupOrder(20, 5, 1, 20)).toMatchObject({
      targetGroupOrder: 20,
      movementType: 'capped_bottom',
    })
  })

  it('GRUPO 15: pos 1–2 → 14, pos 4–5 → 16', () => {
    expect(getTargetGroupOrder(15, 1, 1, 20).targetGroupOrder).toBe(14)
    expect(getTargetGroupOrder(15, 5, 1, 20).targetGroupOrder).toBe(16)
  })
})

describe('validatePromotionPreviewCascade', () => {
  it('acepta movimiento coherente por nombre de grupo', () => {
    const entries = buildPromotionTierLadderEntries([
      { id: 'g15', order_index: 0, name: 'GRUPO 15', players: [1] },
      { id: 'g16', order_index: 1, name: 'GRUPO 16', players: [1] },
    ])
    const errors = validatePromotionPreviewCascade(
      [
        {
          displayName: 'Jugador',
          fromGroupId: 'g15',
          fromGroupOrderIndex: 0,
          fromPosition: 4,
          targetOrderIndex: 1,
          movementType: 'demote',
        },
      ],
      entries,
    )
    expect(errors).toEqual([])
  })
})

describe('isMbBottomTierGroupName', () => {
  it('detecta MB', () => {
    expect(isMbBottomTierGroupName('GRUPO MB')).toBe(true)
  })
})
