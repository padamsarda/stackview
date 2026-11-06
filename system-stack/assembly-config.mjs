// Units are listed from the antenna/FSS-facing end toward the camera in local +Y.
export const CASES = {
  1: {
    title:'Case 1', subtitle:'ADS opposite the camera',
    summary:'Camera/payload, OBC and TTC stay together. EPS–Beacon feeds the top ADS through its centre; the FSS cable runs along the stack to ADCS.',
    order:['beacon','battery','power','wheels','adcs','payload','obc','camera'],
    adsOffset:0, panelRoot:52, panelLength:300, firstCell:73
  },
  2: {
    title:'Case 2', subtitle:'Offset ADS beside the camera',
    summary:'The ADS shares the camera end but its housing and feed are offset from the optical axis. EPS–Beacon sits between camera and OBC; ADCS sits beside the FSS at the opposite end.',
    order:['adcs','battery','power','wheels','payload','obc','beacon','camera'],
    adsOffset:35, panelRoot:60, panelLength:292, firstCell:80
  }
};
export const ROD_LENGTH=170;
export const ROD_RADIUS=.5; // Placeholder diameter: 1 mm, not a qualified antenna design.
export const HOLES=[[0,0],[85.73,3.81],[85.73,-76.2],[0,-73.66]];
export function packLevels(order,bounds,clearance=2){
  const heights={[order[0]]:-bounds[order[0]].min},rows=[];
  for(let i=1;i<order.length;i++){
    const lower=order[i-1],upper=order[i];
    const minPitch=upper==='camera'?0:lower==='battery'&&upper==='power'?18:15.24;
    const extent=bounds[lower].max-bounds[upper].min;
    const pitch=Math.max(minPitch,extent+clearance);
    heights[upper]=heights[lower]+pitch;
    rows.push({lower,upper,pitch,gap:pitch-extent});
  }
  return {heights,rows};
}
