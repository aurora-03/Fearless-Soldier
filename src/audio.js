// Synthesized effects: no downloaded assets, and audio starts only after a user gesture.
export class Sound {
  constructor() { this.context = null; this.enabled = true; }
  unlock() {
    if (!this.enabled) return;
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!this.context) this.context = new Audio();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { this.context = null; }
  }
  play(event, weapon = 0) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const tone = (start,end,duration,volume,type='triangle',delay=0) => {
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),t=now+delay;
      oscillator.type=type; oscillator.frequency.setValueAtTime(start,t); oscillator.frequency.exponentialRampToValueAtTime(end,t+duration);
      gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(volume,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(t);oscillator.stop(t+duration+.01);
    };
    if (['slash','hit','chop'].includes(event)) {
      const duration=[.08,.11,.16][weapon]||.11,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      source.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime([3200,2300,1500][weapon]||2300,now);filter.frequency.exponentialRampToValueAtTime([750,350,180][weapon]||350,now+duration);filter.Q.value=.7;gain.gain.value=.055;
      source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start(now);
    }
    if(event==='hit') {tone([145,115,85][weapon]||115,45,.12,.12,'triangle');tone(1120,660,.075,.027,'sine',.012);}
    if(event==='chop') tone(210,65,.09,.1,'triangle');
    if(event==='hurt') tone(180,60,.16,.12,'sawtooth');
    if(['heal','upgrade','growth','levelup'].includes(event)) {tone(440,440,.1,.06);tone(660,660,.14,.06,'triangle',.08);}
    if(event==='won') {tone(440,440,.2,.07);tone(554,554,.2,.07,'triangle',.16);tone(660,660,.35,.07,'triangle',.32);}
  }
}
