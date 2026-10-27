// Einmalig in App.jsx gerendert: gemeinsame Gradients/Filter/Clips für alle
// Vogel-Grafiken (birdArt.js verweist per url(#nb-…) darauf). width/height 0
// + position:absolute statt display:none, sonst lösen manche Browser die
// Referenzen nicht auf.
export default function BirdDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="nb-fuzz" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" /></filter>
        <filter id="nb-soft"><feGaussianBlur stdDeviation="3.2" /></filter>
        <filter id="nb-soft2"><feGaussianBlur stdDeviation="1.4" /></filter>
        <linearGradient id="nb-branch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8A6A4E" /><stop offset="1" stopColor="#4B362A" /></linearGradient>
        <radialGradient id="nb-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>

        <radialGradient id="nb-rBack" cx="50%" cy="25%" r="85%"><stop offset="0" stopColor="#A88565" /><stop offset=".6" stopColor="#7E5E44" /><stop offset="1" stopColor="#523A2B" /></radialGradient>
        <radialGradient id="nb-rOrange" cx="50%" cy="38%" r="68%"><stop offset="0" stopColor="#F7A55A" /><stop offset=".6" stopColor="#E5762F" /><stop offset="1" stopColor="#BE5622" /></radialGradient>
        <linearGradient id="nb-rBelly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2E7D4" stopOpacity="0" /><stop offset=".5" stopColor="#F2E7D4" /><stop offset="1" stopColor="#E4D5BC" /></linearGradient>
        <linearGradient id="nb-rWing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4A3224" /><stop offset="1" stopColor="#8A6747" /></linearGradient>
        <clipPath id="nb-clipR"><path d="M120 58 C74 60 50 108 52 160 C54 206 86 232 120 232 C154 232 186 206 188 160 C190 108 166 58 120 58 Z" /></clipPath>

        <radialGradient id="nb-bYellow" cx="50%" cy="30%" r="80%"><stop offset="0" stopColor="#F8DD5C" /><stop offset=".7" stopColor="#EAC230" /><stop offset="1" stopColor="#C99A18" /></radialGradient>
        <linearGradient id="nb-bBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5B8FDB" /><stop offset="1" stopColor="#2F5496" /></linearGradient>
        <linearGradient id="nb-bWing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2F5496" /><stop offset="1" stopColor="#5E8AD0" /></linearGradient>
        <radialGradient id="nb-bCheek" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E7E5DA" /></radialGradient>
        <clipPath id="nb-clipB"><path d="M120 62 C80 64 62 108 66 156 C70 204 94 230 120 230 C146 230 170 204 174 156 C178 108 160 64 120 62Z" /></clipPath>

        <radialGradient id="nb-eRobin" cx="38%" cy="30%" r="80%"><stop offset="0" stopColor="#C8EAE6" /><stop offset=".6" stopColor="#8FCFC9" /><stop offset="1" stopColor="#5BA7A5" /></radialGradient>
        <radialGradient id="nb-eMeise" cx="38%" cy="30%" r="80%"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".6" stopColor="#F2EADD" /><stop offset="1" stopColor="#D9CDB8" /></radialGradient>
        <clipPath id="nb-clipEgg"><ellipse cx="120" cy="156" rx="42" ry="56" /></clipPath>
        <radialGradient id="nb-cRobin" cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#D9C3A2" /><stop offset=".6" stopColor="#B39573" /><stop offset="1" stopColor="#82664A" /></radialGradient>
        <radialGradient id="nb-cMeise" cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#F6E6B8" /><stop offset=".6" stopColor="#DCC27E" /><stop offset="1" stopColor="#A98A58" /></radialGradient>
        <clipPath id="nb-clipChick"><circle cx="120" cy="164" r="58" /></clipPath>
      </defs>
    </svg>
  );
}
