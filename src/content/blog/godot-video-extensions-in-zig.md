---
title: "From godot-cpp to Zig"
description: "My first Zig projects were ports of two Godot video extensions I'd written in C++: Godot Native Video and Godot Hap Video."
author:
  name: "Clay Tercek"
  url: "https://tercek.me/"
draft: false
publishedAt: "2026-11-07"
tags:
  - zig
  - godot
  - gdextension
  - video
  - gdzig
authorNotice:
  guest: true
  roles:
    - community member
    - contributor
source:
  url: "https://tercek.me/blog/godot-video-extensions-in-zig/"
  publishedAt: "2026-09-26"
---

My first Zig projects were ports of two Godot video extensions I'd written in C++: [Godot Native Video](https://github.com/claytercek/gdextension-platform-media-streams) and [Godot Hap Video](https://github.com/claytercek/godot-hap-video). Native Video uses the operating system's video decoders to play normal media files. Hap Video plays HAP files, which store frames in compressed texture formats that the GPU can use directly.

I picked Zig mostly out of curiosity. I wanted to try the language, and it gave me a practical way to start: I could keep existing C++ code around while moving pieces over to Zig, rather than rewrite everything before finding out whether I liked it.

I was learning a new language, but working on problems I already knew. Both extensions needed to make video available to Godot, while managing the files and native resources behind that playback. Having working C++ versions made the comparison concrete: I could look at how the same job was expressed in each language.

The connection to Godot was an important part of that. Both projects use GDExtension, Godot's interface for native plugins. The C++ versions used `godot-cpp` to work with that interface. For the Zig ports, I used [gdzig](https://github.com/gdzig/gdzig).

## Letting gdzig handle the Godot side

Godot needs to know which classes and methods an extension provides before it can use them. In gdzig, I still choose what to expose, but the bindings can fill in some of the details from my Zig code.

Here's a shortened example from Hap Video's [`HapPlayer`](https://github.com/claytercek/godot-hap-video/blob/5926774bd904442146420ca871be576be87ea766/src/godot/hap_player.zig#L38-L65):

```zig
pub fn register(r: *Registry) void {
    const class = r.createClass(HapPlayer, r.allocator, .auto);

    class.addMethod("play", .auto);
    class.addMethod("step_frame", .auto);
    class.addProperty("playback_speed", .auto);
}
```

When I register `step_frame`, gdzig finds the Zig function named `stepFrame` and builds the binding from it. For `playback_speed`, it can find the getter and setter using its naming conventions. I can wire those explicitly if the names don't fit.

This is a practical use of Zig's `comptime`, which lets code run during compilation. gdzig can inspect my declarations while building the extension, including reporting an error if a method is missing. Zig provides that ability; gdzig does the work of turning it into something Godot understands.

`godot-cpp` already infers method types from the functions you register. What I prefer here is the name lookup and property conventions on top of that. There's a little less repetitive code to write, and I can still read the registration to see what Godot will get.

## Learning the cleanup rules

Getting Godot to call a function is only part of the job. That function might create a decoder, allocate a buffer, or return an object that needs to stay alive after the call finishes. Those resources still need somebody to release them.

This is where the move to Zig asked more of me. C++ has RAII, where cleanup is tied to an object's lifetime, and `godot-cpp` provides wrappers that handle some of Godot's ownership rules. In the bindings used for these ports, more of that work was explicit.

I like how Zig lets me express it, though. This excerpt from Native Video's [AVFoundation backend](https://github.com/claytercek/gdextension-platform-media-streams/blob/548b96a670ce243c37defa33523c0983b5753170/src/avf/avf_backend.zig#L526-L541) creates a bridge to Apple's video API, then allocates the Zig object that will use it:

```zig
const shim = nv_avf_create() orelse return error.ShimCreateFailed;
errdefer nv_avf_destroy(shim);

const self = try allocator.create(AvfBackend);
```

If the allocation fails, `errdefer` destroys the bridge before the function returns the error. If the function succeeds, the bridge stays alive for the backend to use and release later. The failure cleanup sits beside the thing it cleans up.

C++ can handle this with a resource-owning wrapper. My preference for the Zig version is about reading the code: I can see what happens if setup only gets halfway through, without looking up another type. The cost is that temporary Godot values and shared objects need more manual cleanup and reference counting. That still takes care to get right.

Thanks to [Simon Hartcher (@deevus)](https://github.com/deevus) and [Tristan Pemble (@tristanpemble)](https://github.com/tristanpemble) for helping with the [fixes I brought upstream](https://github.com/gdzig/gdzig/pull/220) during the port. They caught mistakes in my fixes and were great to collaborate with.

## Working on the video code itself

Not every playback problem needs Godot involved. A decoder can be tested on its own, which is useful when you're trying to distinguish a video problem from an engine integration problem.

Native Video already had that separation and headless tests in C++. The part I preferred after the port was describing the build in Zig too, instead of switching to Python and SCons. The same build file assembles the extension and standalone tools from the shared video code. gdzig's [`addExtension`](https://github.com/claytercek/gdextension-platform-media-streams/blob/548b96a670ce243c37defa33523c0983b5753170/build.zig#L90-L137) handles the Godot extension target.

For example, `zig build decode-smoke` runs the platform decoder without launching Godot. I can exercise [Media Foundation on Windows](https://github.com/claytercek/gdextension-platform-media-streams/blob/548b96a670ce243c37defa33523c0983b5753170/build.zig#L70-L84) or [AVFoundation on macOS](https://github.com/claytercek/gdextension-platform-media-streams/blob/548b96a670ce243c37defa33523c0983b5753170/build.zig#L153-L168) using the same backend code the extension uses. I like having those tools alongside the extension in one build.

Hap Video eventually went further on the decoder side. After the binding port, I added a [clean-room Zig HAP decoder](https://github.com/claytercek/godot-hap-video/commit/49ee3dd60d8dc421098c9059d0f54e8f11891fe5) and removed the [vendored C decoder](https://github.com/claytercek/godot-hap-video/commit/1035a0e927f098b61e7ca4001670f8913825dc80). That was a separate project decision, not something gdzig made possible. Revisiting the code led to more work than just changing the bindings.

These were my first Zig projects, and having working C++ versions gave me something concrete to judge the language against. I could separate the benefits of revisiting the code from the parts of Zig I actually preferred.

I'd choose Zig and gdzig again because I like the code I'll be maintaining. When setup fails, I can see the cleanup beside it. When I expose a method to Godot, gdzig fills in details from the code I've already written. Neither changes what the video player can do, but both change what it's like to work on. When the next playback bug shows up, this is the version I want to open.
