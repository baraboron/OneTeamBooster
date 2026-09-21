// Keep PDF category values intact; turn them into natural sentences only in the draft.
(function(root){
  const actions={
    '정보 공유':'필요한 정보를 제때 공유해주신',
    '적극적 경청':'의견을 끝까지 듣고 함께 고민해주신',
    '피드백 수용':'전달한 의견을 열린 마음으로 받아들여주신',
    '책임감(R&R)':'맡은 일을 끝까지 챙겨주신',
    '유연성':'상황이 바뀌어도 유연하게 맞춰주신',
    '공동 목표 의식':'함께 정한 목표를 우선으로 생각해주신',
    '동료 지지':'동료들을 응원하고 도와주신'
  };
  const outcomes={
    '일정 단축':'일을 더 빠르게 마칠 수 있었습니다',
    '품질 향상':'결과물의 완성도를 높일 수 있었습니다',
    '리스크 방지':'문제가 커지기 전에 대응할 수 있었습니다',
    '비용 절감':'불필요한 비용을 줄일 수 있었습니다',
    '팀워크 강화':'서로 믿고 일할 수 있었습니다',
    '시야 확장':'다른 관점에서도 생각해볼 수 있었습니다',
    '동기 부여':'더 의욕적으로 일할 수 있었습니다'
  };
  function draft(values){
    const action=actions[values.boost]||'함께 도와주신',outcome=outcomes[values.impact]||'업무에 도움이 됐습니다';
    const context=values.projectName?values.projectName+'에서 ':'';
    const same=values.recipientScope==='같은팀',other=values.recipientScope==='타팀';
    const senior=values.partner==='상사 / 선배',junior=values.partner==='후배 / 신입';
    const endings=same
      ?senior?'함께 업무를 챙겨 주셔서 감사드립니다.':junior?'함께해 주신 도움이 힘이 됐어요. 고마워요.':'같은 팀으로 함께해 주셔서 고마워요.'
      :other?senior?'부서 간 협업에 도움을 주신 점에 감사드립니다.':junior?'다른 팀과 함께하는 일에 힘을 보태 주셔서 감사합니다.':'다른 팀에서도 협업에 도움을 주셔서 감사합니다.'
      :senior?'감사드립니다.':junior?'함께해 주셔서 고마워요.':'고맙습니다!';
    const effect=same&&!senior?outcome.replace('있었습니다','있었어요'):outcome;
    return values.recipient+'님, '+context+values.mission+' 업무에서 '+action+' 덕분에 '+effect+'. '+endings;
  }
  const api={draft,actions,outcomes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PraiseCopy=api;
})(globalThis);
