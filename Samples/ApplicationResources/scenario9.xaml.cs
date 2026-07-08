//*********************************************************
//
// Copyright (c) Microsoft. All rights reserved.
// THIS CODE IS PROVIDED *AS IS* WITHOUT WARRANTY OF
// ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY
// IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR
// PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.
//
//*********************************************************

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using SDKTemplate;
using System;
using Microsoft.Windows.ApplicationModel.Resources;

namespace SDKTemplate
{
    /// <summary>
    /// An empty page that can be used on its own or navigated to within a Frame.
    /// </summary>
    public sealed partial class Scenario9 : Page
    {
        // A pointer back to the main page.  This is needed if you want to call methods in MainPage such
        // as NotifyUser()
        MainPage rootPage = MainPage.Current;

        public Scenario9()
        {
            this.InitializeComponent();
        }

        /// <summary>
        /// Invoked when this page is about to be displayed in a Frame.
        /// </summary>
        /// <param name="e">Event data that describes how this page was reached.  The Parameter
        /// property is typically used to configure the page.</param>
        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
        }

        /// <summary>
        /// Invoked when the user has selected a different scenario and navigation away from
        /// this page is about to occur.
        /// </summary>
        /// <param name="e">Event data that describes the navigation that has unloaded this
        /// page.</param>
        protected override void OnNavigatedFrom(NavigationEventArgs e)
        {
            base.OnNavigatedFrom(e);
        }

        /// <summary>
        /// This is the click handler for the 'Scenario9Button_Show' button.  You would replace this with your own handler
        /// if you have a button or buttons on this page.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void Scenario9Button_Show_Click(object sender, RoutedEventArgs e)
        {
            Button b = sender as Button;
            if (b != null)
            {
                // Use a fresh MRT Core context for this lookup so the language qualifier
                // override is scoped to this scenario's resource lookup.

                var context = new ResourceManager().CreateResourceContext();

                var selectedLanguage = Scenario9ComboBox.SelectedValue;
                if (selectedLanguage != null)
                {
                    context.QualifierValues["language"] = selectedLanguage.ToString();
                    var resourceStringMap = new ResourceManager().MainResourceMap.GetSubtree("Resources");
                    this.Scenario9TextBlock.Text = resourceStringMap.GetValue("string1", context).ValueAsString;
                }
            }
        }

    }
}

