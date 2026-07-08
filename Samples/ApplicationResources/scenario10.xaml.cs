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
using System.Collections.Generic;

namespace SDKTemplate
{
    /// <summary>
    /// An empty page that can be used on its own or navigated to within a Frame.
    /// </summary>
    public sealed partial class Scenario10 : Page
    {
        // A pointer back to the main page.  This is needed if you want to call methods in MainPage such
        // as NotifyUser()
        MainPage rootPage = MainPage.Current;

        public Scenario10()
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
        /// This is the click handler for the 'Scenario10Button_Show' button.  You would replace this with your own handler
        /// if you have a button or buttons on this page.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void Scenario10Button_Show_Click(object sender, RoutedEventArgs e)
        {
            Button b = sender as Button;
            if (b != null)
            {
                // use a cloned context for this scenario so that qualifier values set
                // in this scenario don't impact behaviour in other scenarios that
                // use a default context for the view (crossover effects between
                // the scenarios will not be expected)
                var context = new ResourceManager().CreateResourceContext();

                var selectedLanguage = Scenario10ComboBox_Language.SelectedValue;
                var selectedScale = Scenario10ComboBox_Scale.SelectedValue;
                var selectedContrast = Scenario10ComboBox_Contrast.SelectedValue;
                var selectedHomeRegion = Scenario10ComboBox_HomeRegion.SelectedValue;

                if (selectedLanguage != null)
                {
                    context.QualifierValues["language"] = selectedLanguage.ToString();
                }
                if (selectedScale != null)
                {
                    context.QualifierValues["scale"] = selectedScale.ToString();
                }
                if (selectedContrast != null)
                {
                    context.QualifierValues["contrast"] = selectedContrast.ToString();
                }
                if (selectedHomeRegion != null)
                {
                    context.QualifierValues["homeregion"] = selectedHomeRegion.ToString();
                }

                Scenario10_SearchMultipleResourceIds(context, new string[] { "LanguageOnly", "ScaleOnly", "ContrastOnly", "HomeRegionOnly", "MultiDimensional" });
            }
        }

        void Scenario10_SearchMultipleResourceIds(ResourceContext context, string[] resourceIds)
        {
            this.Scenario10TextBlock.Text = "";
            var dimensionMap = new ResourceManager().MainResourceMap.GetSubtree("dimensions");

            foreach (var id in resourceIds)
            {
                ResourceCandidate resourceCandidate = dimensionMap.TryGetValue(id, context);
                if (resourceCandidate != null)
                {
                    Scenario10_ShowCandidate(id, resourceCandidate);
                }
            }
        }

        void Scenario10_ShowCandidate(string resourceId, ResourceCandidate resourceCandidate)
        {
            // print 'resourceId', 'found value', and qualifier info for the resolved candidate
            string outText = "resourceId: dimensions\\" + resourceId + "\r\n";
            var value = resourceCandidate.ValueAsString;
            outText += "    Candidate:" + value + "\r\n";
            foreach (var qualifier in resourceCandidate.QualifierValues)
            {
                outText += "        Qualifer: " + qualifier.Key + ": " + qualifier.Value + "\r\n";
            }

            this.Scenario10TextBlock.Text += outText + "\r\n";

        }

    }
}


