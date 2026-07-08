# Used Java Versions in This Repository

## Java 25

This repository uses Java 25 only for running Firebase emulators locally via `run-firebase-emulators.cmd`.

Firebase Emulator Suite tooling is moving toward Java 21+ support, so Java 25 is used here as a future-proof local runtime for the backend functions workflow. The Java version is set only inside the script and does not affect the frontend repositories or the global system Java configuration.

## Java 17

Java 17 is used for the frontend repositories in the z-control app suite and remains the global/default Java version on this machine.

The Firebase Admin Java SDK supports Java 8 and higher, and its maintainers state that Java 11 and Java 17 are the best choices for new development. Java 17 is therefore a safe and compatible choice for the Firebase-related backend code in this repository, as long as it is not the emulator runtime that requires a newer JDK.