/**
 * Lazily load the Razorpay Checkout script and return the global constructor.
 * Only used when real Razorpay keys are configured.
 */
type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loading: Promise<RazorpayCtor> | null = null;

export function loadRazorpayCheckout(): Promise<RazorpayCtor> {
  if (typeof window !== "undefined" && window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  if (loading) return loading;

  loading = new Promise<RazorpayCtor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay Checkout failed to load."));
    };
    script.onerror = () => reject(new Error("Razorpay Checkout failed to load."));
    document.body.appendChild(script);
  });
  return loading;
}
