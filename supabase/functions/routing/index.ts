import { createRoutingHandler } from './handler.ts';
import { TomTomRoutingProvider } from './tomtom.ts';

Deno.serve(createRoutingHandler(new TomTomRoutingProvider(Deno.env.get('TOMTOM_API_KEY'))));
