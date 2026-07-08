@echo off
rem Firebase emulators require Java 21 or above.    
set "JAVA_HOME=C:\Program Files\Java\jdk-25"
set "PATH=%JAVA_HOME%\bin;%PATH%"
firebase emulators:start --only functions,firestore