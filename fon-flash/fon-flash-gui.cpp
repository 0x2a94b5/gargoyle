#include <wx/wx.h>
#include <wx/filename.h>
#include <wx/choice.h>
#include <wx/arrstr.h>
#include <wx/cmdline.h>
#include <wx/init.h>

#define SELECT_FIRMWARE_ID	400
#define FILE1_BROWSE_BUTTON_ID	500
#define FILE2_BROWSE_BUTTON_ID  600
#define FILE3_BROWSE_BUTTON_ID  700
#define FLASH_ROUTER_BUTTON_ID  800


int gui_printf(const char* format, ...);
int gui_fprintf(FILE* stream, const char* format, ...);
void gui_exit(int status);

#define printf gui_printf
#define fprintf gui_fprintf
#define exit gui_exit
#define GUI

#include "fon-flash.c"
#include "fon-flash.xpm"



// how to declare a custom event. this can go in a header
DECLARE_EVENT_TYPE(wxEVT_THREAD, -1)
 
// how to define the custom event
DEFINE_EVENT_TYPE(wxEVT_THREAD)


class WorkerThread: public wxThread
{
	protected:
		wxEvtHandler* parentHandler;
		int inProgress;
		char* dev;
		char* kernel;
		char* root;
	public:
    		WorkerThread(wxEvtHandler* pParent, char* d, char* k, char* r) : wxThread(), parentHandler(pParent)
		{
			inProgress = 0; 
			dev = d;
			kernel = k;
			root = r;
		}
    		wxThread::ExitCode Entry();
		void DoPrint(wxString s);
		
};

wxThread::ExitCode WorkerThread::Entry()
{

	inProgress = 1;

	//gargoyle_flash(dev, root, kernel, 0, 0, 0);	
	
	//parameters are dynamicall allocated, free them
	free(dev);
	free(kernel);
	free(root);
	
	inProgress = 0;
	return EXIT_SUCCESS;
}
void WorkerThread::DoPrint(wxString s)
{
	if(inProgress == 1)
	{
		wxCommandEvent evt(wxEVT_THREAD, wxID_ANY);
		evt.SetString( s );
		parentHandler->AddPendingEvent(evt);
	}
}





class ImagePanel : public wxPanel
{    
	public:
		ImagePanel(wxFrame* parent);
		void paintEvent(wxPaintEvent& evt);
		
		DECLARE_EVENT_TABLE()
};
BEGIN_EVENT_TABLE(ImagePanel, wxPanel)
	EVT_PAINT(ImagePanel::paintEvent)
END_EVENT_TABLE()

ImagePanel::ImagePanel(wxFrame* parent) : wxPanel(parent) { }

void ImagePanel::paintEvent(wxPaintEvent& evt)
{
	wxPaintDC dc(this);
	wxBitmap gargoyleLogo(gargoyle_transfer_xpm);
	dc.DrawBitmap(gargoyleLogo, 215, 0, false);
}



class MainFrame : public wxFrame
{
	public:
		MainFrame(const wxString& title);

		void SetFirmware(wxCommandEvent& evt);

		void OpenFile1Dialog(wxCommandEvent& evt);
		void OpenFile2Dialog(wxCommandEvent& evt);
		void OpenFile3Dialog(wxCommandEvent& evt);
		
		void FlashRouter(wxCommandEvent& evt);
		void OnThreadMessage(wxCommandEvent& evt);
	
		flash_configuration* gargoyle_conf;
		flash_configuration* fonera_conf;
		flash_configuration* current_conf;

		wxChoice      *firmwareChoice; 
		wxChoice      *interfaceChoice;
		wxArrayString *devNames;

		wxStaticText *file1Label;
		wxTextCtrl   *file1Text;
		wxButton     *file1Button;
		
		wxStaticText *file2Label;
		wxTextCtrl   *file2Text;
		wxButton     *file2Button;

		wxStaticText *file3Label;
		wxTextCtrl   *file3Text;
		wxButton     *file3Button;



		wxTextCtrl *outputText;
		WorkerThread* testThread;
	
		DECLARE_EVENT_TABLE()
};



BEGIN_EVENT_TABLE(MainFrame, wxFrame)
	EVT_CHOICE(SELECT_FIRMWARE_ID, MainFrame::SetFirmware)
	EVT_BUTTON(FILE1_BROWSE_BUTTON_ID, MainFrame::OpenFile1Dialog)
	EVT_BUTTON(FILE2_BROWSE_BUTTON_ID, MainFrame::OpenFile2Dialog)
	EVT_BUTTON(FILE3_BROWSE_BUTTON_ID, MainFrame::OpenFile3Dialog)
	EVT_BUTTON(FLASH_ROUTER_BUTTON_ID, MainFrame::FlashRouter)
	EVT_COMMAND(wxID_ANY, wxEVT_THREAD, MainFrame::OnThreadMessage)
END_EVENT_TABLE()


MainFrame *globalAppFrame = NULL;



MainFrame::MainFrame(const wxString& title) : wxFrame(NULL, -1, title, wxDefaultPosition, wxSize(550, 550))
{
	Centre();	
	wxPanel* panel = new ImagePanel(this);
	testThread = NULL;	

	gargoyle_conf = get_gargoyle_configuration();
	fonera_conf   = get_fonera_configuration();
	current_conf = NULL;

	wxArrayString* firmwareTypes = new wxArrayString();
	firmwareTypes->Add(wxT("OpenWrt / Gargoyle Firmware"));
	firmwareTypes->Add(wxT("Official Fonera Firmware"));

	wxStaticText *firmwareLabel = new wxStaticText(panel,-1,wxT("Select Firmware Type:"),wxPoint(3,10));
	firmwareChoice = new wxChoice(panel, SELECT_FIRMWARE_ID, wxPoint(3,30), wxSize(195,25), *firmwareTypes, 0, wxDefaultValidator);
	
	
	
	wxArrayString *devChoiceNames = new wxArrayString();
	devNames = new wxArrayString();
	pcap_if_t *alldevs;
	pcap_if_t *d;
	char errbuf[PCAP_ERRBUF_SIZE];
	pcap_findalldevs(&alldevs, errbuf);
	for(d= alldevs; d != NULL; d= d->next)
	{
		if(strstr(d->name, "lo") != d->name)
		{
			if (d->description)
			{
				wxString s = wxString::FromAscii(d->description);
				devChoiceNames->Add( wxString::FromAscii(d->description), 1);
			}
			else
			{
				devChoiceNames->Add(wxString::FromAscii(d->name), 1);
			}
			devNames->Add(wxString::FromAscii(d->name), 1);
		}
	}
	wxStaticText *interfaceLabel = new wxStaticText(panel,-1,wxT("Select Network Interface:"),wxPoint(5,75));
	interfaceChoice = new wxChoice(panel, -1, wxPoint(5,95), wxSize(195,25), *devChoiceNames, 0, wxDefaultValidator);




		
	file1Label = new wxStaticText(panel,-1,wxT("Select File 1:"),wxPoint(5,145), wxSize(200, 20));
	file1Text = new wxTextCtrl( 
		panel,
		5,
		wxString(wxT("")),
		wxPoint(5, 165),
		wxSize(450, 30),
		0);
	file1Button = new wxButton(panel, FILE1_BROWSE_BUTTON_ID, wxT("Browse"), wxPoint(455,165), wxSize(85, 30));

	file2Label = new wxStaticText(panel,-1,wxT("Select File 2:"),wxPoint(5,220), wxSize(200, 20));
	file2Text = new wxTextCtrl( 
		panel,
		5,
		wxString(wxT("")),
		wxPoint(5, 240),
		wxSize(450, 30),
		0);
	file2Button = new wxButton(panel, FILE2_BROWSE_BUTTON_ID, wxT("Browse"), wxPoint(455,240), wxSize(85, 30));
	
	file3Label = new wxStaticText(panel,-1,wxT("Select File 3:"),wxPoint(5,295), wxSize(200, 20));
	file3Text = new wxTextCtrl( 
		panel,
		5,
		wxString(wxT("")),
		wxPoint(5, 315),
		wxSize(450, 30),
		0);
	file3Button = new wxButton(panel, FILE3_BROWSE_BUTTON_ID, wxT("Browse"), wxPoint(455,315), wxSize(85, 30));


	outputText = new wxTextCtrl( 
		panel,
		5,
		wxString(wxT("")),
		wxPoint(12, 360),
		wxSize(525, 130),
		wxTE_READONLY | wxTE_MULTILINE);

	wxButton *startButton = new wxButton(panel, FLASH_ROUTER_BUTTON_ID, wxT("Flash Router Now!"), wxPoint(75,500), wxSize(400, 40));

	wxCommandEvent evt;
	SetFirmware(evt);
}


void MainFrame::SetFirmware(wxCommandEvent& evt)
{
	int selection = firmwareChoice->GetCurrentSelection();
	if(selection == 0) //openwrt or gargoyle
	{
		file1Label->SetLabel(wxT("Select Rootfs File:"));
		file2Label->SetLabel(wxT("Select Kernel File:"));
		file3Label->Show(false);
		file3Text->Show(false);
		file3Button->Show(false);

		current_conf = gargoyle_conf;
	}
	else //fonera
	{
		file1Label->SetLabel(wxT("Select Loader File:"));
		file2Label->SetLabel(wxT("Select Image File:"));
		file3Label->SetLabel(wxT("Select Image2 File:"));
		file3Label->Show(true);
		file3Text->Show(true);
		file3Button->Show(true);

		current_conf = fonera_conf;
	}
}

void MainFrame::OpenFile1Dialog(wxCommandEvent& evt)
{
	wxFileDialog* selectFile = new wxFileDialog(NULL, wxT("Select File"), wxT(""), wxT(""), wxT("*"), wxOPEN, wxDefaultPosition);
	if( selectFile->ShowModal() == wxID_OK )
	{
		wxString path;
		path.append( selectFile->GetDirectory() );
		path.append( wxFileName::GetPathSeparator() );
		path.append( selectFile->GetFilename() );
		file1Text->SetValue(path);
	}
}
void MainFrame::OpenFile2Dialog(wxCommandEvent& evt)
{
	wxFileDialog* selectFile = new wxFileDialog(NULL, wxT("Select File"), wxT(""), wxT(""), wxT("*"), wxOPEN, wxDefaultPosition);
	if( selectFile->ShowModal() == wxID_OK  )
	{
		wxString path;
		path.append( selectFile->GetDirectory() );
		path.append( wxFileName::GetPathSeparator() );
		path.append( selectFile->GetFilename() );
		file2Text->SetValue(path);
	}
}
void MainFrame::OpenFile3Dialog(wxCommandEvent& evt)
{
	wxFileDialog* selectFile = new wxFileDialog(NULL, wxT("Open Kernel File"), wxT(""), wxT(""), wxT("*"), wxOPEN, wxDefaultPosition);
	if( selectFile->ShowModal() == wxID_OK  )
	{
		wxString path;
		path.append( selectFile->GetDirectory() );
		path.append( wxFileName::GetPathSeparator() );
		path.append( selectFile->GetFilename() );
		file3Text->SetValue(path);
	}
}


void MainFrame::FlashRouter(wxCommandEvent& evt)
{
	//test that files have been selected and that they exist
	/*
	wxString kernelPath = kernelFileText->GetValue();
	wxString rootPath = rootFileText->GetValue();
	
	FILE *testKernel = fopen(kernelPath.ToAscii(), "r");
	FILE *testRoot = fopen(rootPath.ToAscii(), "r");
	if(testKernel == NULL || testRoot == NULL)
	{
		wxString errorString;
		if(testKernel == NULL && testRoot == NULL)
		{
			errorString = wxT("Error: Neither the specified kernel file or the specified rootfs file exists.\n\nPlease indicate the correct loacation of the necessary files and try again.");
		}
		else if(testKernel == NULL)
		{
			errorString = wxT("Error: The specified kernel file does not exist.\n\nPlease indicate the correct loacation of the kernel file and try again.");
		}
		else
		{
			errorString = wxT("Error: The specified rootfs file does not exist.\n\nPlease indicate the correct loacation of the rootfs file and try again.");
		}
		
		
		if(testKernel != NULL) { fclose(testKernel); }
		if(testRoot != NULL) { fclose(testRoot); }
	

		//print error
		wxMessageDialog *errorDialog = new wxMessageDialog(NULL, errorString, wxT("Error"), wxOK | wxICON_ERROR);
		errorDialog->ShowModal();
	}
	else
	{
		fclose(testKernel);
		fclose(testRoot);
		
		//actually flash
		outputText->SetValue(wxT(""));
		char* dev = strdup( (devNames->Item(interfaceChoice->GetCurrentSelection())).ToAscii() );
		char* kernel = strdup(kernelPath.ToAscii());
		char* root = strdup(rootPath.ToAscii());
		testThread =new WorkerThread(this, dev, kernel, root);
		testThread->Create();
		testThread->Run();
		//gui_printf("This is where we'd show the output if we were actually flashing anything");
	}
	*/
}

void MainFrame::OnThreadMessage(wxCommandEvent& evt)
{
	if(globalAppFrame != NULL)
	{
		globalAppFrame->outputText->SetInsertionPointEnd();	
		globalAppFrame->outputText->WriteText( evt.GetString()  );
	}
}















class GargoyleFlash : public wxApp
{
	public:
		virtual bool OnInit();
		char* programName;
};
IMPLEMENT_APP(GargoyleFlash)


bool GargoyleFlash::OnInit()
{
	pcap_if_t *alldevs;
	char errbuf[PCAP_ERRBUF_SIZE];
	pcap_findalldevs(&alldevs, errbuf);
	if(alldevs == NULL )
	{
#ifdef WIN32

		wxMessageDialog *errorDialog = new wxMessageDialog(NULL, wxT("Error: Could not detect any network devices!\n\nMake sure you have administrator privelidges and try again."), wxT("Error"), wxOK | wxICON_ERROR);
		errorDialog->ShowModal();

		
		/*
		wxMessageDialog* d2 = new wxMessageDialog(NULL, wxString::FromAscii(programName), wxT("Error"), wxOK | wxICON_ERROR);
		d2->ShowModal();
		*/



#else
		wxPasswordEntryDialog* passwordDialog = new wxPasswordEntryDialog(NULL, wxT("No Network devices were detected.\n\nThis may be due to lack of administrative priviledges.\nEnter your password below to attempt to authenticate (via sudo), or press cancel to quit."), wxT("Enter a password"), wxT(""), wxOK | wxCANCEL | wxCENTRE);
		if(passwordDialog->ShowModal() == wxID_OK);
		{
			char *password = strdup( passwordDialog->GetValue().ToAscii() );

			char openbuf[500];
			programName = strdup(wxString(wxTheApp->argv[0]).ToAscii());
			sprintf(openbuf, "sudo -S %s >/dev/null 2>&1", programName);


			FILE* stest = popen("sudo -S touch passtest >/dev/null 2>&1", "w");
			fprintf(stest, "%s\n\n\n\n\n\n", password);
			pclose(stest);

			stest = fopen("passtest", "r");
			if(stest != NULL)
			{
				fclose(stest);
				stest = popen("sudo -S rm -f passtest >/dev/null 2>&1", "w");
				fprintf(stest, "%s\n\n\n\n\n\n", password);
				pclose(stest);


				stest =  popen(openbuf, "w");
				fprintf(stest, "%s\n\n\n\n\n\n", password);
			}
			else
			{
				wxMessageDialog *errorDialog = new wxMessageDialog(NULL, wxT("Authentication Failed"), wxT("Authentication Failed"), wxOK | wxICON_ERROR);
				errorDialog->ShowModal();
			}
		}
#endif
	
	
		return false;
	}
	else
	{
		globalAppFrame = new MainFrame(wxT("Gargoyle Easy Flash"));
		globalAppFrame->Show(true);
		SetTopWindow(globalAppFrame);


		return true;
	}
	return false;
}


int gui_printf(const char* format, ...)
{
	if(globalAppFrame != NULL)
	{
		if(globalAppFrame->testThread != NULL)
		{
			va_list args;
			char buf[5000];
			va_start(args, format);
			vsprintf(buf, format, args);
			globalAppFrame->testThread->DoPrint( wxString::FromAscii(buf) );
			va_end(args);
		}
	}
	return 1;
}

int gui_fprintf(FILE* stream, const char* format, ...)
{
	int ret_val = 1;
	va_list args;
	va_start(args, format);
	if(globalAppFrame != NULL && stream == stderr)
	{
		
		if(globalAppFrame->testThread != NULL)
		{
			va_list args;
			char buf[5000];
			va_start(args, format);
			vsprintf(buf, format, args);
			globalAppFrame->testThread->DoPrint( wxString::FromAscii(buf) );
			va_end(args);
		}
	}
	else
	{
		ret_val = vfprintf(stream, format, args);
	}
	va_end(args);
	return ret_val;
}

void gui_exit(int status){}


