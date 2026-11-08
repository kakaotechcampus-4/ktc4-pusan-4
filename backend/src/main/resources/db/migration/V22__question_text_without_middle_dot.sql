-- 질문 문구는 질문을 만들 때 규칙 카드에서 복사해 둔다(QuestionQueueEntity). 카드 문구에서 가운뎃점을 뺐으므로
-- (R-311~R-314, R-244) 이미 만든 질문도 같은 문구로 맞춘다. 문구만 바꾸고 답이나 판정은 건드리지 않는다.
UPDATE question_queue
   SET question_text = replace(question_text, '주말·공휴일', '주말이나 공휴일')
 WHERE question_text LIKE '%주말·공휴일%';

UPDATE question_queue
   SET question_text = replace(question_text, 'PC·휴대폰·전기기구는', 'PC, 휴대폰, 전기기구는')
 WHERE question_text LIKE '%PC·휴대폰·전기기구는%';
