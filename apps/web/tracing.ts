import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import {
  WebTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-web";

const provider = new WebTracerProvider();

provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new OTLPTraceExporter({
      // optional - default url is http://localhost:4318/v1/traces
      // url: "<your-otlp-endpoint>/v1/traces",
      // optional - collection of custom headers to be sent with each request, empty by default
      headers: {},
    })
  )
);

provider.register({
  contextManager: new ZoneContextManager(),
});

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [
        /http:\/\/localhost:3000\.*/,
      ],
    }),
  ],
});
