import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Lock,
  ArrowRight,
  RotateCcw,
  HelpCircle,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { submitLivePhotoVerification } from "@/lib/verify.functions";
import { useServerFn } from "@tanstack/react-start";
import { FestiveConfetti } from "@/components/festive-confetti";
import { playCelebrationChime } from "@/lib/sound-effects";

interface PhotoVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profilePhotoUrl: string | null;
  onVerificationComplete?: (status: string) => void;
}

type VerificationStep = "consent" | "camera" | "preview" | "submitting" | "result";

export function PhotoVerificationModal({
  open,
  onOpenChange,
  profilePhotoUrl,
  onVerificationComplete,
}: PhotoVerificationModalProps) {
  const submitVerification = useServerFn(submitLivePhotoVerification);

  const [step, setStep] = useState<VerificationStep>("consent");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [result, setResult] = useState<{
    status: "approved" | "needs_review" | "rejected";
    reason: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturedAtRef = useRef<number | null>(null);

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Clean up media streams on unmount or modal close
  useEffect(() => {
    if (!open) {
      stopCamera();
      setStep("consent");
      setCapturedDataUrl(null);
      setCameraError(null);
      setResult(null);
      capturedAtRef.current = null;
    }
  }, [open, stopCamera]);

  // Start Camera Stream only after explicit consent
  const startCamera = async () => {
    setCameraError(null);
    setStep("camera");

    let mediaStream: MediaStream | null = null;
    let lastError: any = null;

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        // Attempt 1: Front camera selfie constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err1: any) {
        lastError = err1;
        try {
          // Attempt 2: Minimal unconstrained video request
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err2: any) {
          lastError = err2;
        }
      }
    } else {
      lastError = new Error("Your browser does not support live camera access.");
    }

    if (mediaStream) {
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } else {
      console.warn("Camera stream unavailable:", lastError);
      let msg = "Could not activate camera viewfinder. Please ensure camera access is enabled in your browser or device settings.";
      if (lastError?.name === "NotAllowedError" || lastError?.name === "PermissionDeniedError") {
        msg = "Camera permission was denied. A fresh live camera capture is required for verification to protect our community against stolen photos and fake profiles.";
      } else if (lastError?.name === "NotFoundError" || lastError?.name === "DevicesNotFoundError") {
        msg = "No camera was detected on this device. Please open After9 on a mobile phone or device with a front camera.";
      }
      setCameraError(msg);
    }
  };

  // Re-bind stream to video ref if state updates
  useEffect(() => {
    if (stream && videoRef.current && step === "camera") {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, step]);

  // Capture still snapshot from live video feed
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw current frame (horizontally flipped for natural mirror selfie effect)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedDataUrl(dataUrl);
    capturedAtRef.current = Date.now();

    // Stop camera immediately after capture to respect user privacy
    stopCamera();
    setStep("preview");
  };

  // Submit live capture to server verification endpoint
  const handleSubmitVerification = async () => {
    if (!capturedDataUrl) return;

    setStep("submitting");
    try {
      const res = await submitVerification({
        data: {
          liveSelfieDataUrl: capturedDataUrl,
          capturedAt: capturedAtRef.current ?? Date.now(),
          captureType: "live_camera",
        },
      });

      setResult({
        status: res.status as any,
        reason: res.reason,
      });
      setStep("result");

      if (res.status === "approved") {
        setShowConfetti(true);
        playCelebrationChime();
        toast.success("Photo verified successfully! 🎉");
      } else if (res.status === "needs_review") {
        toast.info("Submitted for manual moderation review.");
      } else {
        toast.error("Photo verification inconclusive.");
      }

      onVerificationComplete?.(res.status);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit photo verification.");
      setResult({
        status: "needs_review",
        reason: "We encountered a temporary processing issue. Your request has been queued for manual review.",
      });
      setStep("result");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border/80 shadow-2xl rounded-2xl">
        {showConfetti && (
          <FestiveConfetti
            count={60}
            durationMs={2600}
            onComplete={() => setShowConfetti(false)}
          />
        )}

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-action/15 via-card to-card p-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-action/20 text-action">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-primary">
                Photo Verification & Authenticity
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Protecting After9 against fake profiles, stolen photos & impersonation
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* STEP 1: Consent & Purpose Disclosure */}
          {step === "consent" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <Camera className="h-4 w-4 text-action shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Fresh Camera Capture Required</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      We compare a fresh live camera capture against your uploaded profile picture to confirm you are the person in your photos. Pre-existing gallery images are not accepted.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-border/50">
                  <UserCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Authenticity & Community Rules</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Display names or nicknames are welcome, but impersonation, stolen photos, and deceptive accounts are strictly prohibited.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-border/50">
                  <Lock className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Private & Protected Evidence</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Your verification selfie is stored in a private bucket accessible only to authorized moderators. It is never displayed publicly or shared with other members.
                    </p>
                  </div>
                </div>
              </div>

              {!profilePhotoUrl && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  ⚠️ Please upload your profile photo first before requesting verification.
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={!profilePhotoUrl}
                  onClick={startCamera}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-action py-3 text-xs font-black uppercase tracking-wider text-action-foreground shadow-md transition hover:opacity-90 disabled:opacity-50 active:scale-[0.98]"
                >
                  <Camera className="h-4 w-4" />
                  <span>Start Camera & Take Selfie</span>
                </button>

                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="text-muted-foreground hover:text-foreground font-medium underline"
                  >
                    Skip for now (Verify later)
                  </button>
                  <span className="text-[11px] text-muted-foreground">Adults 18+ only</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Live Camera Viewfinder */}
          {step === "camera" && (
            <div className="space-y-4">
              {cameraError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center space-y-4 animate-fade-in">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-destructive/15 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-destructive">Camera Access Required</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {cameraError}
                    </p>
                  </div>

                  {/* Browser Permission Steps */}
                  <div className="rounded-xl border border-border/80 bg-background/80 p-3 text-left text-[11px] space-y-1.5 text-muted-foreground">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-action" />
                      How to enable camera access:
                    </p>
                    <p>1. Tap the site security icon (🔒 or ⚙️) next to the website address.</p>
                    <p>2. Allow "Camera" permission for After9.</p>
                    <p>3. Reload this page to apply changes.</p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-1 text-action font-bold underline hover:opacity-80 pt-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reload page to apply new permissions
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="text-xs text-muted-foreground hover:text-foreground pt-1.5 font-medium underline"
                    >
                      Verify Later in Profile
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black border border-border">
                  {/* Live video */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover scale-x-[-1]"
                  />

                  {/* Oval Face Guide Overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-[70%] w-[60%] rounded-[50%] border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  </div>

                  <div className="absolute top-3 inset-x-0 text-center">
                    <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white">
                      Align your face within the frame
                    </span>
                  </div>

                  {/* Shutter Button */}
                  <div className="absolute bottom-4 inset-x-0 flex justify-center">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-action shadow-lg transition active:scale-95"
                      title="Take Verification Selfie"
                    >
                      <Camera className="h-7 w-7 text-action-foreground" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStep("consent");
                  }}
                  className="font-semibold text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
                <span>Ensure good lighting and face clearly visible</span>
              </div>
            </div>
          )}

          {/* STEP 3: Preview Comparison */}
          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground text-center">
                Review your live selfie against your uploaded profile picture:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-center">
                  <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-border bg-muted">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt="Uploaded profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                        No Profile Photo
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">Profile Photo</span>
                </div>

                <div className="space-y-1.5 text-center">
                  <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-action bg-muted relative">
                    {capturedDataUrl && (
                      <img
                        src={capturedDataUrl}
                        alt="Live selfie capture"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white">
                      Live
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-action">Fresh Camera Capture</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-background/80 p-2.5 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Safety review commitment:</p>
                <p>
                  Both images must depict the same person. Natural variations in lighting, hairstyle, or makeup are welcome.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCapturedDataUrl(null);
                    startCamera();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retake</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitVerification}
                  className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-action py-2.5 text-xs font-black uppercase tracking-wider text-action-foreground shadow-md transition hover:opacity-90 active:scale-[0.98]"
                >
                  <span>Submit for Verification</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Submitting Spinner */}
          {step === "submitting" && (
            <div className="py-12 text-center space-y-4">
              <div className="relative mx-auto h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-action/20" />
                <div className="absolute inset-0 rounded-full border-4 border-action border-t-transparent animate-spin" />
                <div className="flex h-full w-full items-center justify-center text-action">
                  <ShieldCheck className="h-7 w-7" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-primary">
                  Reviewing Verification Evidence…
                </h3>
                <p className="text-xs text-muted-foreground px-4">
                  Confirming photo authenticity and checking against safety guidelines.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Result Screen */}
          {step === "result" && result && (
            <div className="py-6 text-center space-y-4">
              {result.status === "approved" && (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-black text-teal-600 dark:text-teal-400">
                      Photo Verified! 🎉
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed px-4">
                      {result.reason || "Your profile has been verified. You now hold the photo verified badge across Discover and Dandiya matching."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-full rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-700 transition"
                  >
                    Done
                  </button>
                </>
              )}

              {result.status === "needs_review" && (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-black text-amber-600 dark:text-amber-400">
                      Queued for Moderator Review
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed px-4">
                      {result.reason || "Your verification check has been submitted to our moderation team for review. You will be updated shortly."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition"
                  >
                    Understood
                  </button>
                </>
              )}

              {result.status === "rejected" && (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                    <XCircle className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-black text-destructive">
                      Verification Inconclusive
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed px-4">
                      {result.reason || "The selfie did not sufficiently match your uploaded photo. Make sure your face is well-lit and avoid filters or heavy obstructions."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-muted"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 rounded-xl bg-action py-2.5 text-xs font-black uppercase tracking-wider text-action-foreground shadow-md hover:opacity-90"
                    >
                      Try Again
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
