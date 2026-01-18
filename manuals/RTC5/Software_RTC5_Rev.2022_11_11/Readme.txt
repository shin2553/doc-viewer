File: README.txt

SCANLAB RTC5 Software Readme

***************************************************************************

Usage

The RTC5 interface board in combination with the software driver is
designed for real-time control of scan systems, lasers and peripheral
equipment by an IBM compatible PC.

The RTC5 software driver and the RTC5 DLL of this package are designed for
Microsoft's 32-bit as well as 64-bit operating systems Windows 10, 8, 7. 
The RTC5 driver supports RTC5's plug and play capability and is able to drive
simultaneously any number of RTC5 boards.

The RTC5 software driver (WDF driver version 6.1.7600.16385) of this 
package only supports the RTC5-DLL of version DLL 535 or higher. 
Older versions (DLL 533 or lower) are no more supported. But all
DLL versions can be used further with the older driver versions 1.0.4.0 
and 2.0.6.0.

When upgrading it is recommended to first exchange the RTC5 software files 
and to test it thoroughly and then update the driver itself.

The files this software package contains are listed below. Additionally the
procedure to install the driver and the corresponding DLL and program files
is described in detail in this Readme file. Further instructions for a
successful operation of the RTC5 board are given in the RTC5 manual.

***************************************************************************

Manufacturer

   SCANLAB GmbH
   Siemensstr. 2a 
   82178 Puchheim
   Germany

   Tel. + 49 (89) 800 746-0
   Fax: + 49 (89) 800 746-199

   info@scanlab.de
   www.scanlab.de

***************************************************************************

Package Description

The RTC5 software contains the following files:

1. Package and Installation Description Files
   README.txt           this file
   LIESMICH.txt         Description in German

2. Correction Files
   cor_1to1.ct5         1:1 correction file (no field correction)
   D2_n.ct5             (optional) 2D correction file
                        n:      number of the correction file
   D2_n_ReadMe.txt      (optional) ReadMe file as description of the
                        corresponding correction file
   D3_n.ct5             (optional) 3D correction file
                        n:      number of the correction file
   D3_n_ReadMe.txt      (optional) ReadMe file as description of the
                        corresponding correction file

   (Note: The correction files of the RTC2, RTC3 and RTC4 interface boards
    use the file name extension "ctb")

3. CorrectionFileConverter Program
   The Win32-based program CorrectionFileConverter.exe converts RTC4
   correction files into RTC5 correction files and vice versa. The package
   also contains the corresponding operating manuals in German and English.

4. Demo Files
   Demo1.cpp … Demo7.cpp  Source code in C of the demo programs 1…7
   Demo1 also as compiled 32- and 64-bit executable files
   Demo3 also as source code in C#
   CMakeLists.txt       Project generating file for CMake
   RTC_Variables.cmake  Include file for CMakeLists.txt

5. HPGL Converter Program
   Win32-based HPGL demo application
   (needs program files and the 32-bit DLL in the same directory)

6. iSCANConfig Program
   The program iSCANcfg5.exe is a Win32-based diagnosis and configuration
   program for iDRIVE scan systems (intelliSCAN, intelliSCANde,
   intelliDRILL, intellicube, intelliWELD, varioSCANde)
   (needs program files, the 32-bit DLL and the RtcHalDLL.dll in the same 
   directory!).
   The package also contains the corresponding operating manuals in
   German Handbuch_iSCANcfg_v1-7.pdf) and English (Manual_iSCANcfg_v1-7.pdf).

7. Windows Driver Files
   RTC5DRV.inf          Device setup information file
   RTC5DRV.cat          Catalog file
   RTC5DRV.sys          .sys file DLL
   RTC5DRVx64.cat       Signed catalog file
   RTC5DRVx64.sys       Signed.sys file DLL
   RTC5DRVx86.cat       Signed catalog file
   RTC5DRVx86.sys       Signed.sys file DLL

   (Notice that the name of the signer of the signed files is:
    "SCANLAB AG".)

   Installation assistant help files:
   amd64/WdfCoInstaller01009.dll
   x86/WdfCoInstaller01009.dll
   
   Security installation script for driver upgrades and description:
   AfterInstallation/ScanlabClassChecker.cmd
   AfterInstallation/ReadMe_ScanlabClassChecker.pdf

8. RTC5 Files

 - DLL File:
   RTC5DLL.DLL          Win32-based RTC5 dynamic link library
   RTC5DLLx64.DLL       Win64-based RTC5 dynamic link library

 - Program Files:
   RTC5OUT.out          DSP program file
   RTC5RBF.rbf          firmware file
   RTC5DAT.dat          binary support file

 - Utility Files for C, C++ and C#:  
   RTC5DLL.lib          Visual C++ import library for implicit linking
                        of the DLL for Win32-based applications
   RTC5DLLx64.lib       Visual C++ import library for implicit linking
                        of the DLL for Win64-based applications
   RTC5expl.c           C functions for DLL handling for explicit linking
   RTC5expl.h           C function prototypes of the RTC5 for explicit
                        linking of the DLL
   RTC5impl.h           C function prototypes of the RTC5 for implicit
                        linking of the DLL
   RTC5impl.hpp         C++ function prototypes of the RTC5 for implicit
                        linking of the DLL
   RTC5Wrap.cs          C# function prototypes of the RTC5 for implicit
                        linking of the DLL. If you intend to compile your
                        C# solution for the 64-bit platform, you need to
                        define the conditional compilation symbol: SL_x64.

 - Utility Files for Delphi:
   RTC5Import.pas       import declarations for Delphi

 - For easy identifying and archiving of different software versions,
   the RTC5 files are also delivered zipped:

   - RTC5DAT_<Version>.zip
   - RTC5DLL_<Version>.zip (includes DLL and utility files)
   - RTC5OUT_<Version>.zip
   - RTC5RBF_<Version>.zip

   Differing versions of the program files and DLL cannot be arbitrarily
   combined with another. Each zip file includes a text file with
   corresponding version information.

9. RTC5 Tools
 - SleepMode.cmd			deactivates all sleep and hibernate modes
 - ReadMe_SleepMode.pdf		description how to use the script

10. Revision History
   Description of changes in the RTC5 software
   RTC5_Software_RevisionHistory_<Date>.pdf       (in English)
   RTC5_Software_Aenderungshistorie_<Date>.pdf    (in German)

If the software is delivered on a data CD, the CD contains all files in
unzipped version. For easy identifying and archiving of different software
versions (also see Revision History), the complete software package is
also delivered zipped: RTC5_Software_<Date>.zip

***************************************************************************

Installation Description

1. Insert the RTC5 board.
2. Start the computer.
3. WINDOWS 7:
   If the "Add Hardware Wizard" does not come up automatically, call him
   from the Control Panel. In the "Add Hardware Wizard" specify the driver 
   directory that includes the RTC5 drivers. During installation, the 
   operating system automatically selects the appropriate driver file 
   (32 oder 64 bit).
   Observe the notices in the ReadMe_ScanlabClassChecker.pdf, if you
   perform an upgrade instead of a new installation of the driver.
   WINDOWS 8, 10:
   Explicitly call WINDOWS' Device Manager. Find entry 'PCI device' in the 
   device tree displayed by the Device Manager and update its driver by 
   specifying the driver directory that includes the RTC5 drivers.
   Observe the notices in the ReadMe_ScanlabClassChecker.pdf, if you
   perform an upgrade instead of a new installation of the driver.
4. Copy or unzip the files RTC5DLL.dll, RTC5OUT.out, RTC5RBF.rbf and
   RTC5DAT.dat to the hard disk of your PC.
   SCANLAB recommends storing these files in the directory in which the
   application software will be started.
   When replacing individual software files, note that differing program
   versions cannot be arbitrarily combined with another (see above).
5. Copy the correction file(s) (*.CT5) to the hard disk of your PC
   (existing correction files can still be used; do not overwrite
   customized correction files!).
   SCANLAB recommends storing these files in the directory in which the
   application software will be started.

With a 64-bit operating system, the 64-bit variant of the RTC5 software
driver (after installation) supports function calls from Win64-based
applications as well as from Win32-based applications. In this way,
existing Win32-based applications for the RTC5 are able to execute
(even on 64-bit systems), if the included Win32-based DLL file RTC5Dll.dll
is used (as with 32-bit systems). For Win64-based applications, the
Win64-based DLL file RTC5DLLx64.dll is included in the software package.
In case an application utilizes implicit linking to the RTC5DLLx64.dll,
it must be linked with the Win64-based import library RTC5DLLx64.LIB.
This is demonstrated in the Demo1 application. The package includes the
corresponding source code Demo1.cpp as well as the Win32-based and the
Win64-based executables demo1.exe.

***************************************************************************

Further instructions for a successful operation of the RTC5 board are
given in the RTC5 manual.

***************************************************************************