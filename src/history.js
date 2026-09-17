export class History {
  constructor() {this.reset({objects:[],offset:0});}
  reset(state) {this.states=[structuredClone(state)];this.index=0;}
  get current() {return this.states[this.index];}
  commit(state) {this.states=this.states.slice(0,this.index+1);this.states.push(structuredClone(state));this.index++;}
  undo() {if(this.index>0)this.index--;}
  redo() {if(this.index<this.states.length-1)this.index++;}
}
export function getCorrections(automatic, current) {
  const ids=new Set(current.objects.map(o=>o.id));
  return {falsePositives:automatic.filter(o=>!ids.has(o.id)),falseNegatives:current.objects.filter(o=>o.source==='manual'),countAdjustment:current.offset,objectGroundTruthComplete:current.offset===0};
}
