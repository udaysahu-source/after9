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
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { submitLivePhotoVerification } from "@/lib/verify.functions";
import { useServerFn } from "@tanstack/react-start";

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
  const [result, setResult] = useState<{
    status: "approved" | "needs_review" | "rejected";
    reason: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelfieFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid photo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setCapturedDataUrl(compressed);
          stopCamera();
          setCameraError(null);
          setStep("preview");
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

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
    }
  }, [open, stopCamera]);

  // Start Camera Stream only after explicit consent
  const startCamera = async () => {
    setCameraError(null);
    setStep("camera");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser does not support camera access.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let msg = "Could not activate camera. Please grant camera permission in your browser settings.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission was denied. Please allow camera access in your browser settings to verify your photo.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No front camera was detected on this device.";
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

  // Capture still snapshot from video feed
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
        },
      });

      setResult({
        status: res.status as any,
        reason: res.reason,
      });
      setStep("result");

      if (res.status === "approved") {
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
        {/* Header */}
        <div className="bg-gradient-to-br from-action/15 via-background to-card p-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/20 text-action">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-action">AUTHENTICITY CHECK</p>
              <DialogTitle className="font-display text-lg font-black text-primary">
                Photo Verification
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Confirm your profile photo with a quick, privacy-protected selfie check.
          </DialogDescription>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* STEP 1: Consent & Purpose Disclosure */}
          {step === "consent" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <Lock className="h-4 w-4 text-action shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">How Verification Works</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      We compare a fresh live selfie against your uploaded profile picture to confirm you are the person in your photos.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-border/50">
                  <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Your Privacy Is Protected</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Your verification selfie is strictly temporary and is discarded immediately after comparison. We never store biometric templates or sell your data.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-border/50">
                  <Camera className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Photo Verified Badge</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Upon verification, your profile receives a visible “Photo verified” badge, increasing trust across the Dandiya deck.
                    </p>
                  </div>
                </div>
              </div>

              {!profilePhotoUrl && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  ⚠️ Please upload a profile photo first before requesting verification.
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!profilePhotoUrl}
                  onClick={startCamera}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-action py-2.5 text-xs font-black uppercase tracking-wider text-action-foreground shadow-md transition hover:opacity-90 disabled:opacity-50"
                >
                  <span>Continue to Camera</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Camera Viewfinder */}
          {step === "camera" && (
            <div className="space-y-4">
              {cameraError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center space-y-4 animate-fade-in">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-destructive/15 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-destructive">Camera Permission Denied</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {cameraError}
                    </p>
                  </div>

                  {/* Browser Permission Steps */}
                  <div className="rounded-xl border border-border/80 bg-background/80 p-3 text-left text-[11px] space-y-1.5 text-muted-foreground">
                    <p className="font-bold text-foreground flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-action" />
                      To enable live camera:
                    </p>
                    <p>1. Tap the <b>lock or site settings icon</b> (🔒 or ⚙️) next to the URL in your browser.</p>
                    <p>2. Set <b>Camera</b> to <b>Allow</b>, then tap Retry.</p>
                  </div>

                  {/* Device Camera Fallback */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="sr-only"
                    onChange={handleSelfieFileUpload}
                  />

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-action py-2.5 text-xs font-bold text-action-foreground shadow-sm transition hover:brightness-105 active:scale-98"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Take Selfie with Device Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry Live Viewfinder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="text-xs text-muted-foreground hover:text-foreground pt-1.5 font-medium underline"
                    >
                      Skip for Now (Verify Later in Profile)
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
                      title="Take Verification Photo"
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
                <span>Ensure good lighting and avoid sunglasses</span>
              </div>
            </div>
          )}

          {/* STEP 3: Preview Comparison */}
          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground text-center">
                Review your live selfie against your current profile picture:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-center">
                  <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-border bg-muted">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No Photo</div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Uploaded Photo
                  </span>
                </div>

                <div className="space-y-1.5 text-center">
                  <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-action/60 bg-muted">
                    {capturedDataUrl ? (
                      <img src={capturedDataUrl} alt="Live Selfie" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No Selfie</div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-action">
                    Live Selfie
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retake
                </button>
                <button
                  type="button"
                  onClick={handleSubmitVerification}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-action py-2.5 text-xs font-black uppercase tracking-wider text-action-foreground shadow-md transition hover:opacity-90"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Submit Check
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Processing */}
          {step === "submitting" && (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="h-10 w-10 animate-spin text-action mx-auto" />
              <div className="space-y-1">
                <h3 className="font-display text-base font-extrabold text-primary">
                  Verifying Photo Authenticity
                </h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Performing server-side face comparison. Temporary captures will be purged upon completion.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Outcome Result */}
          {step === "result" && result && (
            <div className="py-3 text-center space-y-4">
              {result.status === "approved" && (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-600 dark:text-teal-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-black text-teal-600 dark:text-teal-400">
                      Photo Verified!
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed px-4">
                      {result.reason || "Your profile has been authenticated. You're officially live with a verified badge on Discover."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-full rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-700 transition"
                  >
                    Done & Return to Profile
                  </button>
                </>
              )}

              {result.status === "needs_review" && (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-xl font-black text-amber-600 dark:text-amber-400">
                      Queued for Manual Review
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
                      {result.reason || "The selfie did not sufficiently match your uploaded photo. Make sure your face is well-lit and avoid filters, sunglasses, or hats."}
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
