"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AudioLines, BellRing, Camera, CameraOff, Check, ChevronRight, DoorClosed, Heart, Mic, MicOff, Moon, PhoneOff, Settings2, ShieldCheck, Users, Volume2, VolumeX, X } from "lucide-react";
import { BottomDrawer } from "./BottomDrawer";
import { CareHomeHeader } from "./CareHomeChrome";
import { inter, jakarta } from "./OnboardingFlow";
import { currentOnDuty, formatTime, memberById, visitWindowHint } from "@/lib/engine";
import { initials } from "@/lib/care-setup";
import { useStore } from "@/lib/store";
import { useDoorSense } from "@/lib/use-doorsense";
import { DoorCameraPreview } from "./DoorCameraPreview";
import { DoorMotionNotice } from "./DoorMotionNotice";

function DoorAction({ icon, title, detail, tone = "glass", disabled, onClick }: {
  icon: ReactNode; title: string; detail?: string; tone?: "glass" | "primary" | "help" | "end"; disabled?: boolean; onClick: () => void;
}) {
  return <button className={`cs-button doorsense-action ${tone === "help" ? "receiver-help-button" : tone === "end" ? "cs-button--glass door-call-end" : `cs-button--${tone}`}`} disabled={disabled} onClick={onClick} type="button">
    <span className="doorsense-action__icon">{icon}</span><span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
  </button>;
}

function SoundCard({ icon, title, detail, action, disabled, pressed, onClick }: {
  icon: ReactNode; title: string; detail: string; action: string; disabled: boolean; pressed: boolean; onClick: () => void;
}) {
  return <section className="care-card doorsense-sound-card">
    <h2><span className="doorsense-icon">{icon}</span>{title}</h2>
    <p>{detail}</p>
    <button className="cs-button cs-button--glass" aria-pressed={pressed} disabled={disabled} onClick={onClick} type="button">{action}</button>
  </section>;
}

export function DoorSenseScreen() {
  const { state, hydrated, requestHelp } = useStore();
  const { videoRef, caregiverAudioRef, visitorAudioRef, ...door } = useDoorSense(requestHelp);
  const [audioSettings, setAudioSettings] = useState(false);
  const [externalCamera, setExternalCamera] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const caregiver = memberById(state, currentOnDuty(state))?.name ?? "your caregiver";
  const connected = door.connectedAt !== null;
  const showDoor = !!door.visit || door.cameraOn || door.sharing;
  const elapsed = door.connectedAt !== null && clock ? Math.max(0, Math.floor((clock.getTime() - door.connectedAt) / 1000)) : 0;
  const timer = `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;
  const confirmation = door.response === "expecting" || door.response === "dismiss" || door.response === "ended";
  const heading = connected ? `${caregiver} is here with you` : door.sharing ? `Letting ${caregiver} know` : showDoor ? "Person at the door" : "DoorSense";
  const subtitle = connected ? "You’re sharing your camera view." : door.sharing ? "Stay here while your caregiver answers." : showDoor ? "You can choose what happens next." : "Take your time. We’ll let you know.";

  useEffect(() => {
    const update = () => setClock(new Date());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return <main className={`doorsense-screen caregiver-home settings-screen ${inter.variable} ${jakarta.variable}`}>
    <DoorMotionNotice event={door.visit} />
    <div className="doorsense-shell">
      <CareHomeHeader centered back={{ href: "/recipient", label: "My day" }} initials={initials(state.careRecipientName)} onAccount={() => setAudioSettings(true)} />
      <div className="doorsense-content" aria-busy={!hydrated || door.busy}>
        <header className="doorsense-heading">
          <div><p className="doorsense-date">{clock?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}{clock && ` · ${formatTime(clock)}`}</p><h1>{heading}</h1><p>{subtitle}</p></div>
          <span className="home-glass doorsense-duty"><Heart aria-hidden="true" size={20} /><span>{connected ? `Connected · ${timer}` : door.sharing ? "Sharing requested" : `${caregiver} is on duty`}</span></span>
        </header>

        {(door.pollError || door.mediaError) && <div className="doorsense-notice doorsense-notice--error" role="alert">{door.pollError || door.mediaError}</div>}
        {door.message && <div className="doorsense-notice" role="status">{door.message}</div>}

        {confirmation && <section className="care-card doorsense-confirmation" aria-live="polite">
          <span className="doorsense-icon">{door.response === "expecting" ? <Check aria-hidden="true" size={24} /> : door.response === "dismiss" ? <Moon aria-hidden="true" size={24} /> : <PhoneOff aria-hidden="true" size={24} />}</span>
          <div><h2>{door.response === "expecting" ? "Okay, you’re expecting someone" : door.response === "dismiss" ? "Door view closed" : "Sharing has ended"}</h2><p>{door.response === "expecting" ? "Your choice is saved for this visit. Your microphone is off." : door.cameraOn ? "Your microphone is off. You can keep watching or close the camera." : "Camera, microphone and door sound are off."}</p></div>
          {showDoor ? <button className="cs-button cs-button--glass" onClick={() => door.setResponse(null)} type="button">Keep watching <ChevronRight aria-hidden="true" size={18} /></button> : <Link className="cs-button cs-button--glass" href="/recipient">Back to My day <ChevronRight aria-hidden="true" size={18} /></Link>}
        </section>}

        <div className="doorsense-main" hidden={!showDoor}>
          <section className="care-card doorsense-camera-card" aria-label="Door camera">
            <header className="home-section-heading"><h2>Front door</h2><span className={`care-chip${door.visit ? " care-chip--motion" : door.cameraOn || externalCamera ? " care-chip--blue" : ""}`}>{door.visit ? "Motion detected" : door.cameraOpening ? "Opening" : door.cameraOn || externalCamera ? "Watching" : "Camera off"}</span></header>
            <div className={`doorsense-video${door.cameraOn ? " doorsense-video--on" : ""}`}>
              {!door.cameraOn && <DoorCameraPreview enabled={showDoor} onAvailability={setExternalCamera} onStream={door.setExternalStream} />}
              <video ref={videoRef} hidden={!door.cameraOn} playsInline muted autoPlay aria-label="Live receiver-device camera stand-in" />
              {!door.cameraOn && !externalCamera && <div className="doorsense-video__placeholder"><CameraOff aria-hidden="true" size={42} strokeWidth={1.5} /><h2>{door.cameraOpening ? "Opening the camera" : "Camera view is closed"}</h2><p>{door.cameraOpening ? "Your microphone stays off." : "Allow the camera to see this device’s door stand-in."}</p>{!door.cameraOpening && <button className="cs-button cs-button--primary" disabled={door.busy} onClick={() => void door.openCamera()} type="button"><Camera aria-hidden="true" size={20} />Open camera</button>}</div>}
              {door.cameraOn && <><span className="doorsense-video__badge"><span />Live · Device camera</span><div className="doorsense-video__caption"><strong>{door.visit?.label ?? "Door view"}</strong><span>{connected ? "Sharing with your caregiver" : door.sharing ? "Waiting for caregiver connection" : "Only this device is viewing"}</span></div></>}
            </div>
            <p className="settings-note">{externalCamera && !door.cameraOn ? `Live view from the phone watching your door. Your microphone is ${door.micMuted ? "off" : "on for your caregiver"}.` : "This device’s camera is the door stand-in, not a Ring video feed."}</p>
          </section>

          {door.sharing ? <section className="care-card doorsense-call">
            <div className="doorsense-call__heading"><span className="doorsense-icon">{connected ? <AudioLines aria-hidden="true" size={24} /> : <Users aria-hidden="true" size={24} />}</span><span>{connected ? "Caregiver connected" : "Door sharing requested"}</span></div>
            {door.response === "need_help" && <><span className="care-chip care-chip--pending">Urgent help requested</span><p className="settings-note">This is not an emergency call.</p></>}
            <h2>{connected ? `${caregiver} is here with you` : `Waiting for ${caregiver} to answer`}</h2>
            <p>{connected ? "The camera link is connected. Caregiver voice plays here when available." : "Your caregiver can join the camera view and talk with you."}</p>
            <div className="settings-inset doorsense-call__privacy"><strong>{connected ? door.micMuted ? "Your mic is muted" : "Your mic is on" : "No call connected yet"}</strong><p>{connected ? door.micMuted ? "Your microphone isn’t sending sound." : "Your microphone goes to the caregiver link, not the visitor speaker." : "Your microphone stays muted while you wait."}</p></div>
            <DoorAction icon={connected ? <PhoneOff aria-hidden="true" size={24} /> : <X aria-hidden="true" size={24} />} title={connected ? "End call" : "Cancel sharing request"} tone="end" disabled={door.busy} onClick={() => void door.endSession(false)} />
          </section> : <section className="care-card doorsense-responses">
            <header className="home-section-heading"><h2>What would you like to do?</h2></header>
            <p className="settings-note">{visitWindowHint(state)}</p>
            {door.response === "need_help" && <div className="doorsense-notice" role="status">Urgent help request saved. This is not an emergency call.</div>}
            <DoorAction icon={<Check aria-hidden="true" size={24} />} title="I’m expecting someone" disabled={!hydrated || door.busy} onClick={() => void door.respond("expecting")} />
            <DoorAction icon={<Users aria-hidden="true" size={24} />} title="Tell my caregiver" detail={`Share the camera view with ${caregiver}`} tone="primary" disabled={!hydrated || door.busy} onClick={() => void door.respond("tell_caregiver")} />
            <DoorAction icon={<BellRing aria-hidden="true" size={24} />} title="I need help" detail="Send an urgent care request" tone="help" disabled={!hydrated || door.busy} onClick={() => void door.respond("need_help")} />
            <DoorAction icon={<Moon aria-hidden="true" size={24} />} title="Not now" disabled={door.busy} onClick={() => void door.respond("dismiss")} />
          </section>}
        </div>
        <audio ref={caregiverAudioRef} autoPlay playsInline />
        <audio ref={visitorAudioRef} autoPlay playsInline />

        {!showDoor && <section className="care-card doorsense-quiet" aria-live="polite">
          <span className="doorsense-quiet__emblem"><DoorClosed aria-hidden="true" size={48} strokeWidth={1.5} /></span>
          <h2>{door.pollError ? "DoorSense is unavailable" : !door.loaded ? "Checking the door" : "All quiet at the door"}</h2>
          <p>{door.pollError ? "We can’t check for new visitors right now." : "We’ll show you when a door event arrives."}</p>
          <span className="care-chip">{door.pollError ? "Check connection" : door.loaded ? "Ready for door events" : "Checking"}</span>
        </section>}

        {showDoor && <div className="doorsense-sound-grid">
          <SoundCard icon={door.caregiverAudio && door.caregiverVolume > 0 ? <Volume2 aria-hidden="true" size={22} /> : <VolumeX aria-hidden="true" size={22} />} title="Caregiver voice" detail={!connected ? "Off · no call connected" : !door.caregiverAudio ? "Waiting for caregiver audio" : door.caregiverVolume > 0 ? "Sound on" : "Sound muted"} action={door.caregiverAudio ? door.caregiverVolume > 0 ? "Turn sound off" : "Turn sound on" : "No audio connected"} disabled={!door.caregiverAudio} pressed={door.caregiverAudio && door.caregiverVolume > 0} onClick={() => void door.enableSound("caregiver")} />
          <SoundCard icon={door.visitorAudio && door.visitorVolume > 0 ? <Volume2 aria-hidden="true" size={22} /> : <VolumeX aria-hidden="true" size={22} />} title="Visitor sound" detail={!door.visitorAudio ? "No visitor audio connected" : door.visitorVolume > 0 ? "Hear the doorbell microphone" : "Visitor sound muted"} action={door.visitorAudio ? door.visitorVolume > 0 ? "Turn sound off" : "Turn sound on" : "No audio connected"} disabled={!door.visitorAudio} pressed={door.visitorAudio && door.visitorVolume > 0} onClick={() => void door.enableSound("visitor")} />
          <SoundCard icon={door.micMuted ? <MicOff aria-hidden="true" size={22} /> : <Mic aria-hidden="true" size={22} />} title={`My mic · ${door.micMuted ? "Off" : "On"}`} detail={!connected ? "Mic stays off until a call" : door.micMuted ? "Your microphone is muted" : "Sound goes to the caregiver link"} action={connected ? door.micMuted ? "Turn my mic on" : "Mute my mic" : "No call connected"} disabled={!connected} pressed={!door.micMuted} onClick={door.toggleMic} />
        </div>}

        <footer className="doorsense-footer">
          <div className="home-glass doorsense-privacy"><ShieldCheck aria-hidden="true" size={26} /><div><strong>{showDoor ? "You’re in control" : "Your home stays quiet"}</strong><p>{showDoor ? "Sharing starts only when you ask. Closing the view stops this device’s camera, microphone and door sound." : "Camera view closed. Microphone off. No door audio or family call is open."}</p></div></div>
          {showDoor ? <button className="cs-button cs-button--glass" disabled={door.busy} onClick={() => void door.endSession(true)} type="button"><CameraOff aria-hidden="true" size={20} />Close door view</button> : <Link className="cs-button cs-button--glass" href="/recipient">Back to My day <ChevronRight aria-hidden="true" size={18} /></Link>}
          <button className="welcome-screen__help" aria-label="Sound settings" onClick={() => setAudioSettings(true)} type="button"><Settings2 aria-hidden="true" size={22} /></button>
        </footer>
      </div>
    </div>
    {audioSettings && <BottomDrawer title="DoorSense sound" onClose={() => setAudioSettings(false)}>
      <div className="settings-form">
        <label className="doorsense-volume"><span>Caregiver volume <output>{Math.round(door.caregiverVolume * 100)}%</output></span><input aria-label="Caregiver volume" aria-valuetext={`${Math.round(door.caregiverVolume * 100)} percent`} style={{ "--volume-level": `${Math.round(door.caregiverVolume * 100)}%` } as CSSProperties} type="range" min={0} max={1} step={0.05} value={door.caregiverVolume} onChange={(event) => door.setCaregiverVolume(Number(event.target.value))} /></label>
        <label className="doorsense-volume"><span>Visitor volume <output>{Math.round(door.visitorVolume * 100)}%</output></span><input aria-label="Visitor volume" aria-valuetext={`${Math.round(door.visitorVolume * 100)} percent`} style={{ "--volume-level": `${Math.round(door.visitorVolume * 100)}%` } as CSSProperties} type="range" min={0} max={1} step={0.05} value={door.visitorVolume} onChange={(event) => door.setVisitorVolume(Number(event.target.value))} /></label>
        <p className="settings-note">Separate sound controls for the caregiver link and the doorbell microphone. Volume does not start a camera or a call.</p>
        <button className="cs-button cs-button--glass" onClick={() => setAudioSettings(false)} type="button">Done</button>
      </div>
    </BottomDrawer>}
  </main>;
}
