import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // M0 ORIENTATION — the flag is also echoed on the wire
        source: "/modules/orientation",
        headers: [{ key: "X-Breach-Note", value: "CMINUS{V13W_S0URC3_FTW}" }],
      },
    ];
  },
};

export default nextConfig;
