//*********************************************************
//
// Copyright (c) Microsoft. All rights reserved.
// This code is licensed under the MIT License (MIT).
// THIS CODE IS PROVIDED *AS IS* WITHOUT WARRANTY OF
// ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY
// IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR
// PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.
//
//*********************************************************

using System.Collections.Generic;
using System.Text;
using Microsoft.UI.Xaml.Controls;
using Windows.UI.Core.AnimationMetrics;

namespace SDKTemplate
{
    public sealed partial class Scenario1_Metrics : Page
    {
        private readonly List<AnimationOption> _animationOptions = new()
        {
            new AnimationOption("AddToList animation (added target)", AnimationEffect.AddToList, AnimationEffectTarget.Added),
            new AnimationOption("AddToList animation (affected target)", AnimationEffect.AddToList, AnimationEffectTarget.Affected),
            new AnimationOption("EnterPage animation (primary target)", AnimationEffect.EnterPage, AnimationEffectTarget.Primary),
        };

        public Scenario1_Metrics()
        {
            InitializeComponent();
            Animations.ItemsSource = _animationOptions;
            Animations.SelectedIndex = 0;
        }

        private void Animations_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (Animations.SelectedItem is AnimationOption option)
            {
                Metrics.Text = GetMetrics(option.Effect, option.Target);
            }
        }

        private static string GetMetrics(AnimationEffect effect, AnimationEffectTarget target)
        {
            var description = new AnimationDescription(effect, target);
            var builder = new StringBuilder();

            builder.AppendLine($"Effect = {effect}");
            builder.AppendLine($"Target = {target}");
            builder.AppendLine($"Stagger delay = {description.StaggerDelay.TotalMilliseconds:0.###} ms");
            builder.AppendLine($"Stagger delay factor = {description.StaggerDelayFactor:0.###}");
            builder.AppendLine($"Delay limit = {description.DelayLimit.TotalMilliseconds:0.###} ms");
            builder.AppendLine($"Z-order = {description.ZOrder}");
            builder.AppendLine();

            int animationIndex = 0;
            foreach (IPropertyAnimation animation in description.Animations)
            {
                builder.AppendLine($"Animation #{++animationIndex}");

                switch (animation)
                {
                    case ScaleAnimation scale:
                        builder.AppendLine("Type = Scale");
                        if (scale.InitialScaleX.HasValue)
                        {
                            builder.AppendLine($"Initial scale X = {scale.InitialScaleX.Value:0.###}");
                        }

                        if (scale.InitialScaleY.HasValue)
                        {
                            builder.AppendLine($"Initial scale Y = {scale.InitialScaleY.Value:0.###}");
                        }

                        builder.AppendLine($"Final scale X = {scale.FinalScaleX:0.###}");
                        builder.AppendLine($"Final scale Y = {scale.FinalScaleY:0.###}");
                        builder.AppendLine($"Normalized origin = ({scale.NormalizedOrigin.X:0.###}, {scale.NormalizedOrigin.Y:0.###})");
                        break;

                    case TranslationAnimation:
                        builder.AppendLine("Type = Translation");
                        break;

                    case OpacityAnimation opacity:
                        builder.AppendLine("Type = Opacity");
                        if (opacity.InitialOpacity.HasValue)
                        {
                            builder.AppendLine($"Initial opacity = {opacity.InitialOpacity.Value:0.###}");
                        }

                        builder.AppendLine($"Final opacity = {opacity.FinalOpacity:0.###}");
                        break;

                    default:
                        builder.AppendLine($"Type = {animation.Type}");
                        break;
                }

                builder.AppendLine($"Delay = {animation.Delay.TotalMilliseconds:0.###} ms");
                builder.AppendLine($"Duration = {animation.Duration.TotalMilliseconds:0.###} ms");
                builder.AppendLine("Cubic Bezier control points");
                builder.AppendLine($"  Control 1 = ({animation.Control1.X:0.###}, {animation.Control1.Y:0.###})");
                builder.AppendLine($"  Control 2 = ({animation.Control2.X:0.###}, {animation.Control2.Y:0.###})");
                builder.AppendLine();
            }

            return builder.ToString();
        }

        private sealed class AnimationOption
        {
            public AnimationOption(string name, AnimationEffect effect, AnimationEffectTarget target)
            {
                Name = name;
                Effect = effect;
                Target = target;
            }

            public string Name { get; }

            public AnimationEffect Effect { get; }

            public AnimationEffectTarget Target { get; }
        }
    }
}
