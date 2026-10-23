import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, AudioLines, Camera, DoorOpen, Heart, ShieldCheck } from "lucide-react";
import { CameraConnectButton } from "./CameraConnectButton";

const experiences = [
  { name: "The care circle.", description: "A shared picture of the day. Check-ins, reminders, and a clear next step for the person on duty.", href: "/care-circle?view=activity&demo=1", action: "Explore the caregiver demo", icon: Heart, tag: "Caregiver" },
  { name: "A little reassurance.", description: "A simple daily space for checking in, keeping a routine, and asking for help.", href: "/recipient", action: "Open the receiver experience", icon: ShieldCheck, tag: "Receiver" },
  { name: "Meet DoorSense.", description: "A door event becomes a choice: expect a visitor, tell a caregiver, or ask for help.", href: "/doorsense", action: "Open DoorSense", icon: DoorOpen, tag: "At the door" },
  { name: "A view from the door.", description: "Use a phone as a motion-detection camera stand-in. Camera permission and a secure connection are required.", href: "/cam", action: "Open the camera viewfinder", icon: Camera, tag: "Camera test" },
  { name: "Just your voice.", description: "Try spoken check-ins and DoorSense phrases with the browser-based Alexa stand-in.", href: "/alexa", action: "Try voice check-ins", icon: AudioLines, tag: "Voice test" },
  { name: "A conversation, not a screen.", description: "A separate audio-only doorbell endpoint for hearing and speaking with a caregiver.", href: "/doorbell", action: "Open audio-only doorbell", icon: AudioLines, tag: "Audio test" },
];

export function ProductWebsite() {
  return (
    <main className="product-site">
      <nav className="product-nav" aria-label="Website navigation">
        <Link href="/" className="product-brand"><Heart size={21} strokeWidth={2.4} />CareSignal</Link>
        <div className="product-nav__links"><a href="#how-it-works">How it works</a><a href="#experiences">Explore</a></div>
        <Link href="/welcome" className="product-link-button">Open app <ArrowUpRight size={15} /></Link>
      </nav>

      <section className="product-hero">
        <p className="product-eyebrow">A little closer. Even from afar.</p>
        <h1>Care that feels<br />like being there.</h1>
        <p className="product-hero__intro">Everyday reassurance for the people you love.<br className="product-desktop-break" /> A calmer day for the people who care.</p>
        <div className="product-actions"><Link href="/welcome" className="product-button">Open CareSignal <ArrowUpRight size={18} /></Link><a href="#experiences" className="product-text-link">Find your experience <ArrowDown size={17} /></a></div>
        <div className="product-scene">
          <Image src="/images/welcome/quiet-landscape.png" alt="A warmly lit home and front porch at dusk" fill priority sizes="(max-width: 760px) 100vw, 1120px" className="product-scene__image" />
          <div className="product-device product-device--tablet">
            <div className="product-device__bar"><span className="product-brand"><Heart size={16} />CareSignal</span><span>My day</span></div>
            <p className="product-device__greeting">A good day starts<br />with a little hello.</p>
            <div className="product-checkin"><span className="product-symbol"><Heart size={24} /></span><div><strong>How are you today?</strong><p>A small check-in. A little peace of mind.</p></div><span className="product-demo-chip">I&apos;m okay</span></div>
            <div className="product-mini-grid"><div><span>My routine</span><strong>One thing at a time.</strong></div><div><span>My care circle</span><strong>Someone in your corner.</strong></div></div>
            <div className="product-device__door"><DoorOpen size={21} /><div><strong>DoorSense</strong><p>Quiet at the door. Camera off.</p></div><span className="product-dot" /></div>
          </div>
          <div className="product-device product-device--phone">
            <span className="product-phone-speaker" /><p className="product-eyebrow">Your care circle</p><h3>A little<br />peace of mind.</h3>
            <div className="product-phone-status"><span className="product-symbol"><ShieldCheck size={23} /></span><strong>Today, together.</strong><p>Check-ins. Shared routines.<br />Someone on duty.</p></div>
            <div className="product-phone-duty"><span>On duty</span><strong>Elias</strong><span>Your circle, connected.</span></div>
          </div>
          <span className="product-scene__caption">Illustrative product preview</span>
        </div>
      </section>

      <section className="product-story product-section" id="how-it-works">
        <p className="product-eyebrow">Less wondering. More living.</p>
        <h2>Small moments.<br />A meaningful connection.</h2>
        <div className="product-story__grid">
          <p>Care isn&apos;t only the big moments. It&apos;s knowing someone has checked in. Remembering a routine. Having a familiar person to turn to when the doorbell rings.</p>
          <p>CareSignal brings those moments into one shared space, with a simpler experience for the person at home and a clearer picture for their care circle.</p>
        </div>
        <div className="product-steps"><div><span>01</span><h3>Stay in the rhythm.</h3><p>Check-ins and daily reminders keep the everyday things close.</p></div><div><span>02</span><h3>Know who&apos;s there.</h3><p>DoorSense gives the person at home a clear way to respond.</p></div><div><span>03</span><h3>Share the next step.</h3><p>Caregivers can coordinate tasks, duty, and follow-through.</p></div></div>
      </section>

      <section className="product-experiences" id="experiences">
        <div className="product-section"><p className="product-eyebrow">One product. Different ways to connect.</p><h2>Make yourself at home.</h2><p className="product-section__intro">Explore the app, or open a dedicated experience.</p>
          <div className="product-experience-grid">{experiences.map(({ name, description, href, action, icon: Icon, tag }) => <article className="product-experience" key={href}><div className="product-experience__top"><Icon size={27} strokeWidth={1.5} /><span>{tag}</span></div><h3>{name}</h3><p>{description}</p>{href === "/cam" ? <CameraConnectButton className="product-camera-trigger">Connect camera dummy</CameraConnectButton> : <Link href={href}>{action}<ArrowUpRight size={18} /></Link>}</article>)}</div>
          <p className="product-experience-note">The caregiver demo uses example information. Device and voice tools are prototype experiences; household access may be required. The phone camera and browser voice tools are stand-ins, not a Ring camera or Echo device.</p>
        </div>
      </section>

      <section className="product-privacy product-section"><ShieldCheck size={38} strokeWidth={1.4} /><p className="product-eyebrow">Reassurance, with boundaries.</p><h2>Connection.<br />Not constant observation.</h2><p>DoorSense has a quiet state. An event can prompt a response, without an always-on receiver camera. Sharing has an end, and microphone controls stay within reach.</p><Link href="/welcome" className="product-button">Find your way in <ArrowUpRight size={18} /></Link></section>
      <footer className="product-footer"><Link href="/" className="product-brand"><Heart size={18} />CareSignal</Link><p>Made for everyday care.</p><Link href="/welcome">Open app <ArrowUpRight size={15} /></Link></footer>
    </main>
  );
}
