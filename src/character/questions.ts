export interface QuestionCard {
  id: string
  title: string
  placeholder: string
}

export const QUESTIONS: QuestionCard[] = [
  { id: 'first-meet', title: '처음 만났을 때 어땠어요?', placeholder: '예) 카페에서 웃는 모습에 반했어요' },
  { id: 'animal', title: '연인을 동물로 표현하면?', placeholder: '예) 볼이 빵빵한 햄스터' },
  { id: 'color-vibe', title: '연인의 색과 분위기는?', placeholder: '예) 햇살 같은 노란색, 포근한 느낌' },
  { id: 'charm', title: '제일 귀여운 순간은?', placeholder: '예) 졸릴 때 눈 비비는 모습' },
]
