import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, stringValue } from './utils'

export function QuizInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [selected, setSelected] = useState<number | null>(null)
  const question = stringValue(block.payload?.question || blockTitle(block))
  const options = Array.isArray(block.payload?.options) ? block.payload.options.map(stringValue).filter(Boolean).slice(0, 10) : []
  const correct = Number(block.payload?.correct ?? -1)
  const explanation = stringValue(block.payload?.explanation)
  if (!question && !options.length) return null
  return (
    <section className="interactive-v3 interactive-v3-quiz" dir={directionFromText(question)}>
      {question && <h3>{question}</h3>}
      <div className="interactive-v3-quiz-options">
        {options.map((option, index) => {
          const answered = selected !== null
          const isCorrect = answered && index === correct
          const isWrong = answered && selected === index && selected !== correct
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              className={`${selected === index ? 'is-active' : ''} ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}`}
              onClick={() => setSelected(index)}
            >
              <span>{index + 1}</span>
              {option}
            </button>
          )
        })}
      </div>
      {selected !== null && explanation && <p className="interactive-v3-feedback">{explanation}</p>}
    </section>
  )
}
